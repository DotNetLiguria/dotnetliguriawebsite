using System.Text;
using System.Text.RegularExpressions;
using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services;

public sealed class DatabaseBackupService : IPrivacySnapshotStore
{
    private const int _manifestVersion = 1;
    private const int _insertBatchSize = 500;
    private static readonly Regex _snapshotIdPattern = new(
        @"^(?:safety-)?[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly JsonWriterSettings _jsonSettings = new()
    {
        OutputMode = JsonOutputMode.CanonicalExtendedJson,
    };
    private static readonly HashSet<string> _collectionOptionNames = new(StringComparer.Ordinal)
    {
        "autoIndexId",
        "capped",
        "changeStreamPreAndPostImages",
        "clusteredIndex",
        "collation",
        "encryptedFields",
        "expireAfterSeconds",
        "idIndex",
        "indexOptionDefaults",
        "max",
        "recordIdsReplicated",
        "size",
        "storageEngine",
        "temp",
        "timeseries",
        "validationAction",
        "validationLevel",
        "validator",
    };

    private readonly IMongoDatabase _database;
    private readonly string _backupRoot;
    private readonly ILogger<DatabaseBackupService> _logger;
    private readonly TimeProvider _timeProvider;
    private readonly PrivacyOperationGate _operationGate;
    private readonly IErasureJournal? _erasureJournal;
    private readonly PrivacyOptions _privacyOptions;

    public DatabaseBackupService(
        IOptions<DotNetLiguriaDatabaseSettings> settings,
        IHostEnvironment hostEnvironment,
        TimeProvider timeProvider,
        ILogger<DatabaseBackupService> logger,
        PrivacyOperationGate? operationGate = null,
        IErasureJournal? erasureJournal = null,
        IOptions<PrivacyOptions>? privacyOptions = null)
    {
        var databaseSettings = settings.Value;
        var client = new MongoClient(databaseSettings.ConnectionString);
        _database = client.GetDatabase(databaseSettings.DatabaseName);
        _backupRoot = PrivacyStoragePaths.ValidateBackupRoot(databaseSettings.BackupFolder, hostEnvironment.ContentRootPath);
        _timeProvider = timeProvider;
        _logger = logger;
        _operationGate = operationGate ?? PrivacyOperationGate.Shared;
        _erasureJournal = erasureJournal;
        _privacyOptions = privacyOptions?.Value ?? new PrivacyOptions();
    }

    public static bool IsValidSnapshotId(string? snapshotId) =>
        snapshotId is not null && _snapshotIdPattern.IsMatch(snapshotId);

    public static bool IsValidSnapshotName(string? name) =>
        name is null || name.Length <= 120 && !name.Any(char.IsControl);

    public async Task<IReadOnlyList<BackupSnapshotInfo>> ListAsync(CancellationToken cancellationToken)
    {
        PrivacyStoragePaths.RejectLinks(_backupRoot);
        if (!Directory.Exists(_backupRoot))
        {
            return [];
        }

        var snapshots = new List<BackupSnapshotInfo>();
        foreach (var directory in Directory.EnumerateDirectories(_backupRoot))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var snapshotId = Path.GetFileName(directory);
            if (IsValidSnapshotId(snapshotId))
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                {
                    throw new InvalidDataException($"Snapshot '{snapshotId}' must not be a symbolic link.");
                }

                var manifest = await ReadManifestAsync(snapshotId, cancellationToken);
                snapshots.Add(ToSnapshotInfo(snapshotId, manifest));
            }
        }

        return snapshots.OrderByDescending(snapshot => snapshot.CreatedAtUtc).ToArray();
    }

    public async Task<BackupSnapshotInfo> CreateAsync(CancellationToken cancellationToken, string? name = null)
    {
        if (!IsValidSnapshotName(name))
            throw new ArgumentException("A backup name must be at most 120 characters without control characters.", nameof(name));
        using var lease = await _operationGate.EnterAsync(cancellationToken);
        await EnsureOperationsAvailableAsync(cancellationToken);
        return await CreateSnapshotAsync(false, cancellationToken, string.IsNullOrWhiteSpace(name) ? null : name.Trim());
    }

    public async Task<BackupRestoreResult?> RestoreAsync(string snapshotId, CancellationToken cancellationToken)
    {
        ValidateSnapshotId(snapshotId);
        using var lease = await _operationGate.EnterAsync(cancellationToken);
        await EnsureOperationsAvailableAsync(cancellationToken);
        if (!Directory.Exists(GetSnapshotPath(snapshotId)))
        {
            return null;
        }

        var manifest = await ReadManifestAsync(snapshotId, cancellationToken);
        var epoch = await GetEpochAsync(cancellationToken);
        if (!manifest.TryGetValue("privacyEpoch", out var snapshotEpoch) ||
            snapshotEpoch.BsonType != BsonType.String || snapshotEpoch.AsString != epoch)
            throw new PrivacyBlockedException("snapshot_predates_privacy_boundary");
        await ValidateSnapshotFilesAsync(snapshotId, manifest, cancellationToken);

        var safetySnapshot = await CreateSnapshotAsync(true, cancellationToken);
        await ReplaceDatabaseAsync(manifest, snapshotId, cancellationToken);
        return new BackupRestoreResult(snapshotId, safetySnapshot);
    }

    // Caller holds the shared operation gate. No snapshot is assumed anonymous merely because an ID was not found.
    public async Task PurgeForErasureUnderGateAsync(CancellationToken cancellationToken)
    {
        PrivacyStoragePaths.RejectLinks(_backupRoot);
        Directory.CreateDirectory(_backupRoot);
        await WriteEpochAsync(Guid.NewGuid().ToString("N"), cancellationToken);
        foreach (var path in Directory.EnumerateFileSystemEntries(_backupRoot))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (Path.GetFileName(path) == ".privacy") continue;
            RejectTreeLinks(path);
            if (Directory.Exists(path)) Directory.Delete(path, true);
            else File.Delete(path);
        }
        if (Directory.EnumerateFileSystemEntries(_backupRoot).Any(path => Path.GetFileName(path) != ".privacy"))
            throw new PrivacyBlockedException("snapshot_purge_not_verified");
    }

    private async Task EnsureOperationsAvailableAsync(CancellationToken cancellationToken)
    {
        PrivacyStoragePaths.RejectLinks(_backupRoot);
        if (!_privacyOptions.ProtectedStorageApproved || _erasureJournal is null)
            throw new PrivacyBlockedException("protected_backup_storage_not_approved");
        if ((await _erasureJournal.ListAsync(cancellationToken)).Count != 0)
            throw new PrivacyBlockedException("erasure_in_progress", StatusCodes.Status409Conflict);
    }

    private static void RejectTreeLinks(string path)
    {
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new PrivacyBlockedException("linked_storage_not_supported");
        if (Directory.Exists(path))
            foreach (var child in Directory.EnumerateFileSystemEntries(path))
                RejectTreeLinks(child);
    }

    private async Task<string> GetEpochAsync(CancellationToken cancellationToken)
    {
        var path = Path.Combine(_backupRoot, ".privacy", "backup.epoch");
        PrivacyStoragePaths.RejectLinks(Path.GetDirectoryName(path)!);
        if (!File.Exists(path))
        {
            var epoch = Guid.NewGuid().ToString("N");
            await WriteEpochAsync(epoch, cancellationToken);
            return epoch;
        }
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new PrivacyBlockedException("invalid_backup_privacy_epoch");
        var existing = await File.ReadAllTextAsync(path, cancellationToken);
        if (!Guid.TryParseExact(existing, "N", out _))
            throw new PrivacyBlockedException("invalid_backup_privacy_epoch");
        return existing;
    }

    private async Task WriteEpochAsync(string epoch, CancellationToken cancellationToken)
    {
        var root = Path.Combine(_backupRoot, ".privacy");
        PrivacyStoragePaths.RejectLinks(root);
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, "backup.epoch");
        if (File.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new PrivacyBlockedException("invalid_backup_privacy_epoch");
        var pending = path + ".pending";
        await using (var stream = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            4096, FileOptions.WriteThrough | FileOptions.Asynchronous))
        {
            await stream.WriteAsync(Encoding.UTF8.GetBytes(epoch), cancellationToken);
            await stream.FlushAsync(cancellationToken);
            stream.Flush(true);
        }
        File.Move(pending, path, true);
    }

    private async Task<BackupSnapshotInfo> CreateSnapshotAsync(bool isSafetySnapshot, CancellationToken cancellationToken, string? name = null)
    {
        PrivacyStoragePaths.RejectLinks(_backupRoot);
        Directory.CreateDirectory(_backupRoot);
        var createdAtUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var snapshotId = CreateSnapshotId(createdAtUtc, isSafetySnapshot);
        var temporaryPath = Path.Combine(_backupRoot, $".{snapshotId}.{Guid.NewGuid():N}.tmp");
        Directory.CreateDirectory(temporaryPath);

        try
        {
            var collectionInfos = await GetCollectionInfosAsync(cancellationToken);
            var collectionManifest = new BsonArray();
            long totalDocumentCount = 0;

            for (var index = 0; index < collectionInfos.Count; index++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var collectionInfo = collectionInfos[index];
                var collectionName = collectionInfo["name"].AsString;
                var fileName = $"collection-{index:D4}.jsonl";
                var collection = _database.GetCollection<BsonDocument>(collectionName);
                var documentCount = await WriteCollectionAsync(collection, Path.Combine(temporaryPath, fileName), cancellationToken);
                var indexes = await ReadIndexesAsync(collection, cancellationToken);
                var options = collectionInfo.GetValue("options", new BsonDocument()).AsBsonDocument.DeepClone().AsBsonDocument;
                if (collectionInfo.TryGetValue("idIndex", out var idIndex) && idIndex.BsonType == BsonType.Document)
                {
                    options["idIndex"] = idIndex;
                }

                collectionManifest.Add(new BsonDocument
                {
                    { "name", collectionName },
                    { "file", fileName },
                    { "documentCount", documentCount },
                    { "options", options },
                    { "indexes", indexes },
                });
                totalDocumentCount += documentCount;
            }

            var manifest = new BsonDocument
            {
                { "version", _manifestVersion },
                { "createdAtUtc", createdAtUtc },
                { "isSafetySnapshot", isSafetySnapshot },
                { "privacyEpoch", await GetEpochAsync(cancellationToken) },
                { "collections", collectionManifest },
            };
            if (name is not null) manifest.Add("name", name);
            ValidateManifest(manifest);
            await File.WriteAllTextAsync(
                Path.Combine(temporaryPath, "manifest.json"),
                manifest.ToJson(_jsonSettings),
                new UTF8Encoding(false),
                cancellationToken);

            var completedPath = GetSnapshotPath(snapshotId);
            Directory.Move(temporaryPath, completedPath);
            _logger.LogInformation(
                "Created MongoDB backup snapshot {SnapshotId} with {CollectionCount} collections and {DocumentCount} documents.",
                snapshotId,
                collectionManifest.Count,
                totalDocumentCount);
            return ToSnapshotInfo(snapshotId, manifest);
        }
        finally
        {
            if (Directory.Exists(temporaryPath))
            {
                Directory.Delete(temporaryPath, true);
            }
        }
    }

    private async Task<List<BsonDocument>> GetCollectionInfosAsync(CancellationToken cancellationToken)
    {
        using var cursor = await _database.ListCollectionsAsync(
            new ListCollectionsOptions { Filter = new BsonDocument("type", "collection") },
            cancellationToken);
        var collectionInfos = await cursor.ToListAsync(cancellationToken);
        return collectionInfos
            .Where(info => !info["name"].AsString.StartsWith("system.", StringComparison.Ordinal))
            .OrderBy(info => info["name"].AsString, StringComparer.Ordinal)
            .ToList();
    }

    private static async Task<long> WriteCollectionAsync(
        IMongoCollection<BsonDocument> collection,
        string filePath,
        CancellationToken cancellationToken)
    {
        long documentCount = 0;
        await using var stream = new FileStream(filePath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, true);
        await using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        using var cursor = await collection.FindAsync(
            FilterDefinition<BsonDocument>.Empty,
            cancellationToken: cancellationToken);

        while (await cursor.MoveNextAsync(cancellationToken))
        {
            foreach (var document in cursor.Current)
            {
                await writer.WriteLineAsync(document.ToJson(_jsonSettings).AsMemory(), cancellationToken);
                documentCount++;
            }
        }

        return documentCount;
    }

    private static async Task<BsonArray> ReadIndexesAsync(
        IMongoCollection<BsonDocument> collection,
        CancellationToken cancellationToken)
    {
        using var cursor = await collection.Indexes.ListAsync(cancellationToken);
        var indexes = await cursor.ToListAsync(cancellationToken);
        return new BsonArray(indexes);
    }

    private async Task<BsonDocument> ReadManifestAsync(string snapshotId, CancellationToken cancellationToken)
    {
        ValidateSnapshotId(snapshotId);
        var manifestPath = Path.Combine(GetSnapshotPath(snapshotId), "manifest.json");
        if (!File.Exists(manifestPath))
        {
            throw new InvalidDataException($"Snapshot '{snapshotId}' has no manifest.");
        }
        if ((File.GetAttributes(manifestPath) & FileAttributes.ReparsePoint) != 0)
        {
            throw new InvalidDataException($"Snapshot '{snapshotId}' has an invalid manifest file.");
        }

        var manifestText = await File.ReadAllTextAsync(manifestPath, cancellationToken);
        BsonDocument manifest;
        try
        {
            manifest = BsonDocument.Parse(manifestText);
        }
        catch (FormatException exception)
        {
            throw new InvalidDataException($"Snapshot '{snapshotId}' has an invalid manifest.", exception);
        }

        ValidateManifest(manifest);
        return manifest;
    }

    private static void ValidateManifest(BsonDocument manifest)
    {
        if (!manifest.TryGetValue("version", out var version) ||
            version.BsonType != BsonType.Int32 ||
            version.AsInt32 != _manifestVersion ||
            !manifest.TryGetValue("createdAtUtc", out var createdAt) ||
            createdAt.BsonType != BsonType.DateTime ||
            !manifest.TryGetValue("isSafetySnapshot", out var isSafetySnapshot) ||
            isSafetySnapshot.BsonType != BsonType.Boolean ||
            !manifest.TryGetValue("collections", out var collections) ||
            collections.BsonType != BsonType.Array)
        {
            throw new InvalidDataException("The backup manifest is missing required fields or uses an unsupported version.");
        }

        if (manifest.TryGetValue("name", out var snapshotName) &&
            (snapshotName.BsonType != BsonType.String || !IsValidSnapshotName(snapshotName.AsString)))
            throw new InvalidDataException("The backup manifest contains an invalid name.");

        var names = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var collectionValue in collections.AsBsonArray)
        {
            if (collectionValue.BsonType != BsonType.Document)
            {
                throw new InvalidDataException("The backup manifest contains an invalid collection entry.");
            }

            var collection = collectionValue.AsBsonDocument;
            if (!collection.TryGetValue("name", out var nameValue) ||
                nameValue.BsonType != BsonType.String ||
                string.IsNullOrWhiteSpace(nameValue.AsString) ||
                nameValue.AsString.StartsWith("system.", StringComparison.Ordinal) ||
                nameValue.AsString.Contains('\0') ||
                !names.Add(nameValue.AsString) ||
                !collection.TryGetValue("file", out var fileValue) ||
                fileValue.BsonType != BsonType.String ||
                fileValue.AsString != $"collection-{index:D4}.jsonl" ||
                !collection.TryGetValue("documentCount", out var documentCount) ||
                documentCount.BsonType is not (BsonType.Int32 or BsonType.Int64) ||
                documentCount.ToInt64() < 0 ||
                !collection.TryGetValue("options", out var options) ||
                options.BsonType != BsonType.Document ||
                !collection.TryGetValue("indexes", out var indexes) ||
                indexes.BsonType != BsonType.Array ||
                !AreValidIndexes(indexes.AsBsonArray) ||
                !AreValidCollectionOptions(options.AsBsonDocument))
            {
                throw new InvalidDataException("The backup manifest contains an invalid collection description.");
            }

            index++;
        }
    }

    private async Task ValidateSnapshotFilesAsync(
        string snapshotId,
        BsonDocument manifest,
        CancellationToken cancellationToken)
    {
        foreach (var collection in manifest["collections"].AsBsonArray.Select(value => value.AsBsonDocument))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var fileName = collection["file"].AsString;
            var filePath = Path.Combine(GetSnapshotPath(snapshotId), fileName);
            if (!File.Exists(filePath))
            {
                throw new InvalidDataException($"Snapshot '{snapshotId}' is missing a collection file.");
            }
            if ((File.GetAttributes(filePath) & FileAttributes.ReparsePoint) != 0)
            {
                throw new InvalidDataException($"Snapshot '{snapshotId}' has an invalid collection file.");
            }

            long documentCount = 0;
            using var reader = new StreamReader(filePath, Encoding.UTF8, true);
            while (await reader.ReadLineAsync(cancellationToken) is { } line)
            {
                if (line.Length == 0)
                {
                    throw new InvalidDataException($"Snapshot '{snapshotId}' contains an empty document line.");
                }

                try
                {
                    _ = BsonDocument.Parse(line);
                }
                catch (FormatException exception)
                {
                    throw new InvalidDataException($"Snapshot '{snapshotId}' contains an invalid document.", exception);
                }

                documentCount++;
            }

            if (documentCount != collection["documentCount"].ToInt64())
            {
                throw new InvalidDataException($"Snapshot '{snapshotId}' has an unexpected document count.");
            }
        }
    }

    private async Task ReplaceDatabaseAsync(
        BsonDocument manifest,
        string snapshotId,
        CancellationToken cancellationToken)
    {
        var currentCollectionInfos = await GetCollectionInfosAsync(cancellationToken);
        foreach (var collectionInfo in currentCollectionInfos)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await _database.DropCollectionAsync(collectionInfo["name"].AsString, cancellationToken);
        }

        foreach (var collectionValue in manifest["collections"].AsBsonArray)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var collectionManifest = collectionValue.AsBsonDocument;
            var collectionName = collectionManifest["name"].AsString;
            await CreateCollectionAsync(collectionName, collectionManifest["options"].AsBsonDocument, cancellationToken);
            var collection = _database.GetCollection<BsonDocument>(collectionName);
            await ImportCollectionAsync(
                collection,
                Path.Combine(GetSnapshotPath(snapshotId), collectionManifest["file"].AsString),
                cancellationToken);
            await CreateIndexesAsync(collectionName, collectionManifest["indexes"].AsBsonArray, cancellationToken);
        }
    }

    private async Task CreateCollectionAsync(
        string collectionName,
        BsonDocument options,
        CancellationToken cancellationToken)
    {
        var command = new BsonDocument("create", collectionName);
        foreach (var option in options)
        {
            if (_collectionOptionNames.Contains(option.Name))
            {
                var value = option.Value;
                if (option.Name == "idIndex" && value.BsonType == BsonType.Document)
                {
                    var idIndex = value.AsBsonDocument.DeepClone().AsBsonDocument;
                    idIndex.Remove("v");
                    idIndex.Remove("ns");
                    value = idIndex;
                }

                command[option.Name] = value;
            }
        }

        await _database.RunCommandAsync<BsonDocument>(command, cancellationToken: cancellationToken);
    }

    private static async Task ImportCollectionAsync(
        IMongoCollection<BsonDocument> collection,
        string filePath,
        CancellationToken cancellationToken)
    {
        var batch = new List<BsonDocument>(_insertBatchSize);
        using var reader = new StreamReader(filePath, Encoding.UTF8, true);
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            batch.Add(BsonDocument.Parse(line));
            if (batch.Count == _insertBatchSize)
            {
                await collection.InsertManyAsync(batch, cancellationToken: cancellationToken);
                batch.Clear();
            }
        }

        if (batch.Count > 0)
        {
            await collection.InsertManyAsync(batch, cancellationToken: cancellationToken);
        }
    }

    private async Task CreateIndexesAsync(
        string collectionName,
        BsonArray indexes,
        CancellationToken cancellationToken)
    {
        var indexSpecifications = new BsonArray();
        foreach (var indexValue in indexes)
        {
            var index = indexValue.AsBsonDocument.DeepClone().AsBsonDocument;
            if (index.GetValue("name", BsonNull.Value).AsString == "_id_")
            {
                continue;
            }

            index.Remove("v");
            index.Remove("ns");
            indexSpecifications.Add(index);
        }

        if (indexSpecifications.Count == 0)
        {
            return;
        }

        await _database.RunCommandAsync<BsonDocument>(
            new BsonDocument
            {
                { "createIndexes", collectionName },
                { "indexes", indexSpecifications },
            },
            cancellationToken: cancellationToken);
    }

    private string GetSnapshotPath(string snapshotId)
    {
        ValidateSnapshotId(snapshotId);
        var snapshotPath = Path.GetFullPath(Path.Combine(_backupRoot, snapshotId));
        var rootWithSeparator = Path.EndsInDirectorySeparator(_backupRoot)
            ? _backupRoot
            : _backupRoot + Path.DirectorySeparatorChar;
        var pathComparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!snapshotPath.StartsWith(rootWithSeparator, pathComparison))
        {
            throw new ArgumentException("The snapshot identifier is invalid.", nameof(snapshotId));
        }

        PrivacyStoragePaths.RejectLinks(snapshotPath);
        return snapshotPath;
    }

    private static BackupSnapshotInfo ToSnapshotInfo(string snapshotId, BsonDocument manifest)
    {
        var collections = manifest["collections"].AsBsonArray;
        var documentCount = collections
            .Select(collection => collection.AsBsonDocument["documentCount"].ToInt64())
            .Sum();
        return new BackupSnapshotInfo(
            snapshotId,
            manifest["createdAtUtc"].AsBsonDateTime.ToUniversalTime(),
            collections.Count,
            documentCount,
            manifest["isSafetySnapshot"].AsBoolean,
            manifest.TryGetValue("name", out var name) ? name.AsString : null);
    }

    private static bool AreValidIndexes(BsonArray indexes) =>
        indexes.All(item =>
            item.BsonType == BsonType.Document &&
            item.AsBsonDocument.TryGetValue("name", out var indexName) &&
            indexName.BsonType == BsonType.String &&
            item.AsBsonDocument.TryGetValue("key", out var indexKeys) &&
            indexKeys.BsonType == BsonType.Document &&
            indexKeys.AsBsonDocument.ElementCount > 0);

    private static bool AreValidCollectionOptions(BsonDocument options) =>
        options.All(option => _collectionOptionNames.Contains(option.Name)) &&
        (!options.TryGetValue("idIndex", out var idIndex) ||
            idIndex.BsonType == BsonType.Document &&
            idIndex.AsBsonDocument.TryGetValue("name", out var indexName) &&
            indexName.BsonType == BsonType.String &&
            idIndex.AsBsonDocument.TryGetValue("key", out var indexKeys) &&
            indexKeys.BsonType == BsonType.Document &&
            indexKeys.AsBsonDocument.ElementCount > 0);

    private static string CreateSnapshotId(DateTime createdAtUtc, bool isSafetySnapshot)
    {
        var timestamp = createdAtUtc.ToString("yyyyMMdd'T'HHmmssfff'Z'", System.Globalization.CultureInfo.InvariantCulture);
        var randomSuffix = Guid.NewGuid().ToString("N")[..8];
        return $"{(isSafetySnapshot ? "safety-" : string.Empty)}{timestamp}-{randomSuffix}";
    }

    private static void ValidateSnapshotId(string snapshotId)
    {
        if (!IsValidSnapshotId(snapshotId))
        {
            throw new ArgumentException("The snapshot identifier is invalid.", nameof(snapshotId));
        }
    }
}
