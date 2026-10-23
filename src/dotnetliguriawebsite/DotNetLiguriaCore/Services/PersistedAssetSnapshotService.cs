using System.Security.Cryptography;
using System.Text;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace DotNetLiguriaCore.Services;

public sealed class PersistedAssetSnapshotService(string contentsRoot, string privateUploadsRoot)
{
    private const string _contentsDirectory = "contents";
    private const string _workshopUploadsDirectory = "workshop-uploads";

    private readonly string _contentsRoot = Path.GetFullPath(contentsRoot);
    private readonly string _privateUploadsRoot = Path.GetFullPath(privateUploadsRoot);

    public async Task<BsonDocument> CaptureAsync(
        string snapshotRoot,
        string? workshopFilesPath,
        CancellationToken cancellationToken)
    {
        var snapshotContentsRoot = Path.Combine(snapshotRoot, _contentsDirectory);
        var snapshotUploadsRoot = Path.Combine(snapshotRoot, _workshopUploadsDirectory);
        Directory.CreateDirectory(snapshotContentsRoot);
        Directory.CreateDirectory(snapshotUploadsRoot);

        var contents = await CopyTreeAsync(_contentsRoot, snapshotContentsRoot, cancellationToken);
        var workshopFiles = await ReadWorkshopFilesAsync(workshopFilesPath, cancellationToken);
        var privateAssets = new BsonArray();
        var copiedNames = new HashSet<string>(StringComparer.Ordinal);
        foreach (var file in workshopFiles.Where(IsPrivateUpload))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var fileName = GetSafePrivateFileName(file);
            if (!copiedNames.Add(fileName))
                throw new InvalidDataException("Workshop records refer to a duplicate private upload filename.");

            var sourcePath = Path.Combine(_privateUploadsRoot, fileName);
            RejectLinks(sourcePath);
            if (!File.Exists(sourcePath))
                throw new InvalidDataException($"Private workshop upload '{fileName}' is missing from persistent storage.");

            var (length, hash) = await CopyFileAsync(sourcePath,
                Path.Combine(snapshotUploadsRoot, fileName), cancellationToken);
            privateAssets.Add(new BsonDocument
            {
                { "workshopFileId", file.WorkshopFileId.ToString("D") },
                { "file", fileName },
                { "length", length },
                { "sha256", hash },
            });
        }

        return new BsonDocument
        {
            { "contents", contents },
            { "workshopUploads", privateAssets },
        };
    }

    public async Task ValidateAsync(
        string snapshotRoot,
        BsonDocument manifest,
        string? workshopFilesPath,
        CancellationToken cancellationToken)
    {
        if (!manifest.TryGetValue("contents", out var contentsValue) || contentsValue.BsonType != BsonType.Array ||
            !manifest.TryGetValue("workshopUploads", out var uploadsValue) || uploadsValue.BsonType != BsonType.Array)
            throw new InvalidDataException("The snapshot is missing its persisted asset manifests.");

        var contentPaths = await ValidateFilesAsync(snapshotRoot, _contentsDirectory,
            contentsValue.AsBsonArray, "path", cancellationToken);
        var uploadPaths = await ValidateFilesAsync(snapshotRoot, _workshopUploadsDirectory,
            uploadsValue.AsBsonArray, "file", cancellationToken);

        var workshopFiles = await ReadWorkshopFilesAsync(workshopFilesPath, cancellationToken);
        var privateNames = new HashSet<string>(StringComparer.Ordinal);
        foreach (var file in workshopFiles.Where(IsPrivateUpload))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var fileName = GetSafePrivateFileName(file);
            if (!privateNames.Add(fileName) || !uploadPaths.Contains(fileName))
                throw new InvalidDataException("A private workshop file record has no matching snapshot asset.");
        }

        if (privateNames.Count != uploadPaths.Count)
            throw new InvalidDataException("The snapshot contains an unreferenced private workshop asset.");

        foreach (var file in workshopFiles)
        {
            var contentPath = GetLocalContentsPath(file.FullPath);
            if (contentPath is not null && !contentPaths.Contains(contentPath))
                throw new InvalidDataException("A workshop file record has no matching public content asset in the snapshot.");
        }
    }

    public async Task ValidateLegacyReferencesAsync(
        string? workshopFilesPath,
        CancellationToken cancellationToken)
    {
        foreach (var file in await ReadWorkshopFilesAsync(workshopFilesPath, cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (IsPrivateUpload(file))
            {
                var fileName = GetSafePrivateFileName(file);
                var path = Path.Combine(_privateUploadsRoot, fileName);
                RejectLinks(path);
                if (!File.Exists(path))
                    throw new InvalidDataException("This older snapshot references private workshop uploads but does not contain their media. Create a new media-aware snapshot first.");
                continue;
            }

            var contentPath = GetLocalContentsPath(file.FullPath);
            if (contentPath is null) continue;
            var pathInContents = GetSafePath(_contentsRoot, contentPath);
            RejectLinks(pathInContents);
            if (!File.Exists(pathInContents))
                throw new InvalidDataException("This older snapshot references public content that is not present on this server. Create a new media-aware snapshot first.");
        }
    }

    public async Task RestoreAsync(
        string snapshotRoot,
        BsonDocument manifest,
        CancellationToken cancellationToken)
    {
        var contentEntries = manifest["contents"].AsBsonArray;
        var uploadEntries = manifest["workshopUploads"].AsBsonArray;
        await RestoreFilesAsync(snapshotRoot, _contentsDirectory, _contentsRoot,
            contentEntries, "path", cancellationToken);
        await RestoreFilesAsync(snapshotRoot, _workshopUploadsDirectory, _privateUploadsRoot,
            uploadEntries, "file", cancellationToken);
        PruneReplacedPrivateUploads(uploadEntries.Select(entry => entry.AsBsonDocument["file"].AsString)
            .ToHashSet(StringComparer.Ordinal));
    }

    private async Task<BsonArray> CopyTreeAsync(
        string sourceRoot,
        string destinationRoot,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(sourceRoot);
        RejectTreeLinks(sourceRoot);
        var entries = new BsonArray();
        var paths = Directory.EnumerateFiles(sourceRoot, "*", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.Ordinal);
        foreach (var sourcePath in paths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            RejectLinks(sourcePath);
            var relativePath = ToPortableRelativePath(sourceRoot, sourcePath);
            var destinationPath = GetSafePath(destinationRoot, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            var (length, hash) = await CopyFileAsync(sourcePath, destinationPath, cancellationToken);
            entries.Add(new BsonDocument
            {
                { "path", relativePath },
                { "length", length },
                { "sha256", hash },
            });
        }

        return entries;
    }

    private static async Task<HashSet<string>> ValidateFilesAsync(
        string snapshotRoot,
        string directoryName,
        BsonArray entries,
        string pathField,
        CancellationToken cancellationToken)
    {
        var filesRoot = Path.Combine(snapshotRoot, directoryName);
        RejectTreeLinks(filesRoot);
        var validated = new HashSet<string>(StringComparer.Ordinal);
        foreach (var entryValue in entries)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (entryValue.BsonType != BsonType.Document)
                throw new InvalidDataException("A persisted asset manifest entry is invalid.");
            var entry = entryValue.AsBsonDocument;
            if (!entry.TryGetValue(pathField, out var pathValue) || pathValue.BsonType != BsonType.String ||
                !entry.TryGetValue("length", out var lengthValue) || lengthValue.BsonType is not (BsonType.Int32 or BsonType.Int64) ||
                lengthValue.ToInt64() < 0 || !entry.TryGetValue("sha256", out var hashValue) ||
                hashValue.BsonType != BsonType.String || !IsSha256(hashValue.AsString))
                throw new InvalidDataException("A persisted asset manifest entry is invalid.");

            var relativePath = pathValue.AsString;
            if (!validated.Add(relativePath))
                throw new InvalidDataException("A persisted asset manifest contains a duplicate path.");
            var filePath = GetSafePath(filesRoot, relativePath);
            RejectLinks(filePath);
            if (!File.Exists(filePath))
                throw new InvalidDataException("A persisted asset is missing from the snapshot.");
            var (length, hash) = await HashFileAsync(filePath, cancellationToken);
            if (length != lengthValue.ToInt64() || !string.Equals(hash, hashValue.AsString, StringComparison.Ordinal))
                throw new InvalidDataException("A persisted asset failed its snapshot integrity check.");
        }

        var actualCount = Directory.Exists(filesRoot)
            ? Directory.EnumerateFiles(filesRoot, "*", SearchOption.AllDirectories).Count()
            : 0;
        if (actualCount != validated.Count)
            throw new InvalidDataException("A persisted asset snapshot contains files that are not described by its manifest.");
        return validated;
    }

    private static async Task RestoreFilesAsync(
        string snapshotRoot,
        string sourceDirectory,
        string destinationRoot,
        BsonArray entries,
        string pathField,
        CancellationToken cancellationToken)
    {
        var sourceRoot = Path.Combine(snapshotRoot, sourceDirectory);
        RejectLinks(destinationRoot);
        Directory.CreateDirectory(destinationRoot);
        foreach (var entry in entries.Select(value => value.AsBsonDocument))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var relativePath = entry[pathField].AsString;
            var sourcePath = GetSafePath(sourceRoot, relativePath);
            var destinationPath = GetSafePath(destinationRoot, relativePath);
            RejectLinks(sourcePath);
            RejectLinks(destinationPath);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            var pendingPath = destinationPath + "." + Guid.NewGuid().ToString("N") + ".pending";
            try
            {
                await CopyFileAsync(sourcePath, pendingPath, cancellationToken);
                File.Move(pendingPath, destinationPath, true);
            }
            finally
            {
                if (File.Exists(pendingPath)) File.Delete(pendingPath);
            }
        }
    }

    private void PruneReplacedPrivateUploads(IReadOnlySet<string> retainedFiles)
    {
        RejectLinks(_privateUploadsRoot);
        Directory.CreateDirectory(_privateUploadsRoot);
        foreach (var path in Directory.EnumerateFiles(_privateUploadsRoot, "*", SearchOption.TopDirectoryOnly))
        {
            RejectLinks(path);
            var name = Path.GetFileName(path);
            if (name != ".gitkeep" && IsManagedPrivateUploadName(name) && !retainedFiles.Contains(name))
                File.Delete(path);
        }
    }

    private static async Task<List<WorkshopFile>> ReadWorkshopFilesAsync(
        string? workshopFilesPath,
        CancellationToken cancellationToken)
    {
        if (workshopFilesPath is null || !File.Exists(workshopFilesPath)) return [];
        var files = new List<WorkshopFile>();
        using var reader = new StreamReader(workshopFilesPath, Encoding.UTF8, true);
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            if (line.Length == 0) throw new InvalidDataException("The workshop file snapshot contains an empty document.");
            files.Add(BsonSerializer.Deserialize<WorkshopFile>(BsonDocument.Parse(line)));
        }

        return files;
    }

    private static bool IsPrivateUpload(WorkshopFile file) =>
        file.FullPath == $"/api/WorkshopFile/Download/{file.WorkshopFileId:D}";

    private static string GetSafePrivateFileName(WorkshopFile file)
    {
        if (file.WorkshopFileId == Guid.Empty ||
            !WorkshopUploadValidation.TryGetSafeExtension(file.FileName, file.FileType, out var extension) ||
            file.FileName != $"{file.WorkshopFileId:N}{extension}")
            throw new InvalidDataException("A private workshop file record has an invalid asset filename.");
        return file.FileName;
    }

    private static bool IsManagedPrivateUploadName(string name)
    {
        var extension = Path.GetExtension(name);
        var stem = Path.GetFileNameWithoutExtension(name);
        return extension.Length > 0 && Guid.TryParseExact(stem, "N", out _);
    }

    private static string? GetLocalContentsPath(string? fullPath)
    {
        if (string.IsNullOrWhiteSpace(fullPath) || fullPath.Contains('\\') || fullPath.Contains('?') ||
            fullPath.Contains('#') || fullPath.Contains(':')) return null;
        if (Uri.TryCreate(fullPath, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https") return null;
        var relativePath = fullPath.StartsWith("/Contents/", StringComparison.Ordinal)
            ? fullPath[10..]
            : fullPath.StartsWith("Contents/", StringComparison.Ordinal)
                ? fullPath[9..]
                : fullPath.TrimStart('/');
        if (relativePath.StartsWith("api/", StringComparison.Ordinal)) return null;
        return IsSafeRelativePath(relativePath) ? relativePath : null;
    }

    private static string ToPortableRelativePath(string root, string path)
    {
        var relativePath = Path.GetRelativePath(root, path)
            .Replace(Path.DirectorySeparatorChar, '/')
            .Replace(Path.AltDirectorySeparatorChar, '/');
        if (!IsSafeRelativePath(relativePath))
            throw new InvalidDataException("A persisted content path is outside its storage root.");
        return relativePath;
    }

    private static string GetSafePath(string root, string portableRelativePath)
    {
        if (!IsSafeRelativePath(portableRelativePath))
            throw new InvalidDataException("A persisted asset path is invalid.");
        var fullRoot = Path.GetFullPath(root);
        var fullPath = Path.GetFullPath(Path.Combine(fullRoot,
            portableRelativePath.Replace('/', Path.DirectorySeparatorChar)));
        var prefix = Path.EndsInDirectorySeparator(fullRoot) ? fullRoot : fullRoot + Path.DirectorySeparatorChar;
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!fullPath.StartsWith(prefix, comparison))
            throw new InvalidDataException("A persisted asset path escapes its storage root.");
        return fullPath;
    }

    private static bool IsSafeRelativePath(string path) =>
        !string.IsNullOrWhiteSpace(path) && !Path.IsPathRooted(path) && !path.Contains('\\') && !path.Contains(':') &&
        path.Split('/').All(segment => segment.Length > 0 && segment is not ("." or ".."));

    private static bool IsSha256(string value) => value.Length == 64 && value.All(Uri.IsHexDigit);

    private static async Task<(long Length, string Hash)> CopyFileAsync(
        string sourcePath,
        string destinationPath,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
        await using var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read,
            65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
        await using var destination = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write,
            FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[65536];
        long length = 0;
        while (true)
        {
            var read = await source.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            hash.AppendData(buffer, 0, read);
            await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            length += read;
        }

        await destination.FlushAsync(cancellationToken);
        return (length, Convert.ToHexStringLower(hash.GetHashAndReset()));
    }

    private static async Task<(long Length, string Hash)> HashFileAsync(
        string path,
        CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read,
            65536, FileOptions.Asynchronous | FileOptions.SequentialScan);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[65536];
        long length = 0;
        while (true)
        {
            var read = await stream.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            hash.AppendData(buffer, 0, read);
            length += read;
        }

        return (length, Convert.ToHexStringLower(hash.GetHashAndReset()));
    }

    private static void RejectLinks(string path)
    {
        if (File.Exists(path) || Directory.Exists(path))
        {
            if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("Persisted asset snapshots do not support symbolic links.");
        }

        for (var current = new DirectoryInfo(Path.GetDirectoryName(Path.GetFullPath(path))!);
             current is not null; current = current.Parent)
            if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("Persisted asset snapshots do not support symbolic links.");
    }

    private static void RejectTreeLinks(string path)
    {
        RejectLinks(path);
        if (Directory.Exists(path))
            foreach (var child in Directory.EnumerateFileSystemEntries(path))
                RejectTreeLinks(child);
    }
}
