using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoLifecycle(IPhotoStore store, PhotoStorage storage, PhotoService service)
{
    private readonly IPhotoStore _store = store;
    private readonly PhotoStorage _storage = storage;
    private readonly PhotoService _service = service;

    public Task AttributeAsync(string profileKey, AccountReference account, CancellationToken token) =>
        _store.AttributeAsync(profileKey, account, token);

    public async Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account, CancellationToken token)
    {
        var related = (await _store.RelatedAsync(account, token)).Select(x => x.Key).ToHashSet(StringComparer.Ordinal);
        var result = new List<BsonDocument>();
        foreach (var selection in await _store.SelectionsAsync(token))
            if (related.Contains(selection.Key))
                result.Add(new BsonDocument { { "kind", "photo-selection" }, { "document", selection.ToBsonDocument() } });
        long total = 0;
        foreach (var asset in await OwnedAsync(account, related, token))
        {
            var data = new BsonDocument { { "metadata", asset.ToBsonDocument() } };
            foreach (var size in new[] { 128, 512 })
            {
                var image = await _storage.ReadAsync(asset, size, token);
                total += image.Length;
                if (total > 16 * 1024 * 1024) throw new PrivacyBlockedException("photo_export_limit_exceeded", 413);
                data[size.ToString(System.Globalization.CultureInfo.InvariantCulture)] = Convert.ToBase64String(image);
            }
            result.Add(new BsonDocument { { "kind", "profile-photo" }, { "document", data } });
        }
        return result;
    }

    // The privacy coordinator already holds the shared gate; retries must remain idempotent.
    public async Task EraseAsync(AccountReference account, CancellationToken token)
    {
        var related = await _store.RelatedAsync(account, token);
        var keys = related.Select(x => x.Key).ToHashSet(StringComparer.Ordinal);
        var assets = await OwnedAsync(account, keys, token);
        var ids = assets.Select(x => x.Id).ToHashSet();
        foreach (var target in await _store.PublicTargetsAsync(token))
        {
            var effective = await _service.ResolveAsync(target, token);
            if (target.Key.StartsWith("board:", StringComparison.Ordinal) &&
                (keys.Contains(target.Key) || effective.AssetId is Guid id && ids.Contains(id)))
                await _store.UnpublishAsync(target.Key, token);
        }
        var selections = await _store.SelectionsAsync(token);
        foreach (var selection in selections)
            if (keys.Contains(selection.Key) || selection.AssetId is Guid id && ids.Contains(id))
                await _store.SaveAsync(new PhotoSelection { Key = selection.Key, Source = "none" }, selection.Version, token);
        foreach (var target in related.Where(x => !selections.Any(s => s.Key == x.Key)))
            await _store.SaveAsync(new PhotoSelection { Key = target.Key, Source = "none" }, "legacy", token);
        foreach (var asset in assets)
        {
            _storage.Delete(asset.Id);
            await _store.DeleteAssetAsync(asset.Id, token);
        }
        await _store.DeleteSelectionAsync(PhotoTarget.AccountKey(account), token);
        if ((await OwnedAsync(account, keys, token)).Count != 0)
            throw new PrivacyBlockedException("photo_erasure_not_verified");
    }

    public async Task CleanupUnreferencedAsync(CancellationToken token)
    {
        var ids = (await _store.SelectionsAsync(token)).Where(x => x.AssetId is not null)
            .Select(x => x.AssetId!.Value).ToHashSet();
        foreach (var asset in await _store.AssetsAsync(token))
            if (!ids.Contains(asset.Id))
            {
                _storage.Delete(asset.Id);
                await _store.DeleteAssetAsync(asset.Id, token);
            }
    }

    private async Task<IReadOnlyList<PhotoAsset>> OwnedAsync(AccountReference account, IReadOnlySet<string> keys, CancellationToken token) =>
        (await _store.AssetsAsync(token)).Where(asset => keys.Contains(asset.OwnerKey) ||
            asset.AccountIssuer == account.Issuer && asset.AccountSubject == account.Subject).ToArray();
}
