using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoSnapshotService(IPhotoStore store, PhotoStorage storage, PhotoLifecycle lifecycle)
{
    private readonly IPhotoStore _store = store;
    private readonly PhotoStorage _storage = storage;
    private readonly PhotoLifecycle _lifecycle = lifecycle;

    public Task PrepareAsync(CancellationToken token) => _lifecycle.CleanupUnreferencedAsync(token);

    public async Task<BsonArray> CaptureAsync(string snapshotRoot, CancellationToken token)
    {
        var manifest = new BsonArray();
        foreach (var asset in await _store.AssetsAsync(token))
            foreach (var size in new[] { 128, 512 })
            {
                var bytes = await _storage.ReadAsync(asset, size, token);
                var name = PhotoStorage.FileName(asset.Id, size);
                await File.WriteAllBytesAsync(Path.Combine(snapshotRoot, name), bytes, token);
                manifest.Add(new BsonDocument
                {
                    { "file", name }, { "id", asset.Id.ToString("D") }, { "size", size },
                    { "sha256", PhotoStorage.Hash(bytes) }
                });
            }
        return manifest;
    }

    public static async Task<IReadOnlyList<PhotoAsset>> ReadAssetsAsync(string snapshotRoot,
        BsonDocument manifest, CancellationToken token)
    {
        var description = manifest["collections"].AsBsonArray.Select(x => x.AsBsonDocument)
            .SingleOrDefault(x => x["name"] == MongoPhotoStore.AssetCollection);
        if (description is null) return [];
        var assets = new List<PhotoAsset>();
        using var reader = new StreamReader(Path.Combine(snapshotRoot, description["file"].AsString));
        while (await reader.ReadLineAsync(token) is { } line)
            assets.Add(BsonSerializer.Deserialize<PhotoAsset>(BsonDocument.Parse(line)));
        return assets;
    }

    public static async Task ValidateAsync(string snapshotRoot, BsonDocument manifest, CancellationToken token)
    {
        var assets = await ReadAssetsAsync(snapshotRoot, manifest, token);
        var selections = manifest["collections"].AsBsonArray.Select(x => x.AsBsonDocument)
            .SingleOrDefault(x => x["name"] == MongoPhotoStore.SelectionCollection);
        if (selections is not null)
        {
            using var reader = new StreamReader(Path.Combine(snapshotRoot, selections["file"].AsString));
            while (await reader.ReadLineAsync(token) is { } line)
            {
                var selection = BsonSerializer.Deserialize<PhotoSelection>(BsonDocument.Parse(line));
                if (selection.AssetId is Guid id && !assets.Any(asset => asset.Id == id))
                    throw new InvalidDataException("Photo selection references missing asset metadata.");
            }
        }
        if (assets.Count == 0)
        {
            if (manifest.TryGetValue("photos", out var empty) && (empty is not BsonArray array || array.Count != 0))
                throw new InvalidDataException("Unexpected photo manifest.");
            return;
        }
        if (!manifest.TryGetValue("photos", out var value) || value is not BsonArray photos || photos.Count != assets.Count * 2)
            throw new InvalidDataException("Database-only snapshot references missing photo media.");
        foreach (var asset in assets)
            foreach (var size in new[] { 128, 512 })
            {
                var name = PhotoStorage.FileName(asset.Id, size);
                var entries = photos.Where(x => x.IsBsonDocument && x.AsBsonDocument.GetValue("file", "") == name).ToArray();
                var expected = size == 128 ? asset.SmallHash : asset.LargeHash;
                if (entries.Length != 1 || entries[0].AsBsonDocument.GetValue("sha256", "") != expected ||
                    entries[0].AsBsonDocument.GetValue("id", "") != asset.Id.ToString("D") ||
                    entries[0].AsBsonDocument.GetValue("size", 0) != size)
                    throw new InvalidDataException("Invalid photo manifest entry.");
                var path = Path.Combine(snapshotRoot, name);
                if (!File.Exists(path) || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0 ||
                    new FileInfo(path).Length > PhotoImageProcessor.MaximumBytes ||
                    PhotoStorage.Hash(await File.ReadAllBytesAsync(path, token)) != expected)
                    throw new InvalidDataException("Photo snapshot integrity verification failed.");
            }
    }

    public async Task RestoreAsync(string snapshotRoot, BsonDocument manifest, CancellationToken token)
    {
        foreach (var asset in await ReadAssetsAsync(snapshotRoot, manifest, token))
        {
            var variants = new Dictionary<int, byte[]>();
            foreach (var size in new[] { 128, 512 })
                variants[size] = await File.ReadAllBytesAsync(Path.Combine(snapshotRoot, PhotoStorage.FileName(asset.Id, size)), token);
            await _storage.SaveAsync(asset.Id, variants, token, allowExisting: true);
        }
    }

    public Task<IReadOnlyList<PhotoAsset>> CurrentAssetsAsync(CancellationToken token) => _store.AssetsAsync(token);

    public async Task RemoveReplacedAssetsAsync(IReadOnlyList<PhotoAsset> previous, CancellationToken token)
    {
        var retained = (await _store.AssetsAsync(token)).Select(x => x.Id).ToHashSet();
        foreach (var asset in previous)
            if (!retained.Contains(asset.Id)) _storage.Delete(asset.Id);
    }
}
