using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Photos;

internal sealed class FakePhotoStore : IPhotoStore
{
    public Dictionary<string, PhotoTarget> Targets { get; } = [];
    public Dictionary<string, PhotoSelection> Selections { get; } = [];
    public Dictionary<Guid, PhotoAsset> Assets { get; } = [];
    public Task<PhotoTarget?> TargetAsync(string key, CancellationToken token) => Task.FromResult(Targets.GetValueOrDefault(key));
    public Task<IReadOnlyList<PhotoTarget>> RelatedAsync(AccountReference account, CancellationToken token) =>
        Task.FromResult<IReadOnlyList<PhotoTarget>>([MongoPhotoStore.AccountTarget(account), .. Targets.Values.Where(x => x.Account == account)]);
    public Task<IReadOnlyList<PhotoTarget>> PublicTargetsAsync(CancellationToken token) =>
        Task.FromResult<IReadOnlyList<PhotoTarget>>(Targets.Values.Where(x => x.IsPublic).ToArray());
    public Task<IReadOnlyList<PhotoTarget>> SpeakerTargetsAsync(CancellationToken token) =>
        Task.FromResult<IReadOnlyList<PhotoTarget>>(Targets.Values.Where(x => x.Key.StartsWith("speaker:", StringComparison.Ordinal)).ToArray());
    public Task<IReadOnlyList<PhotoTarget>> BoardTargetsAsync(CancellationToken token) =>
        Task.FromResult<IReadOnlyList<PhotoTarget>>(Targets.Values.Where(x => x.Key.StartsWith("board:", StringComparison.Ordinal)).ToArray());
    public Task<PhotoSelection?> SelectionAsync(string key, CancellationToken token) => Task.FromResult(Selections.GetValueOrDefault(key));
    public Task<IReadOnlyList<PhotoSelection>> SelectionsAsync(CancellationToken token) =>
        Task.FromResult<IReadOnlyList<PhotoSelection>>(Selections.Values.ToArray());
    public Task SaveAsync(PhotoSelection selection, string expectedVersion, CancellationToken token)
    {
        if ((Selections.GetValueOrDefault(selection.Key)?.Version ?? "legacy") != expectedVersion)
            throw new PrivacyBlockedException("photo_changed_reload", 409);
        Selections[selection.Key] = selection;
        return Task.CompletedTask;
    }
    public Task AddAssetAsync(PhotoAsset asset, CancellationToken token) { Assets.Add(asset.Id, asset); return Task.CompletedTask; }
    public Task<PhotoAsset?> AssetAsync(Guid id, CancellationToken token) => Task.FromResult(Assets.GetValueOrDefault(id));
    public Task<IReadOnlyList<PhotoAsset>> AssetsAsync(CancellationToken token) => Task.FromResult<IReadOnlyList<PhotoAsset>>(Assets.Values.ToArray());
    public Task DeleteAssetAsync(Guid id, CancellationToken token) { Assets.Remove(id); return Task.CompletedTask; }
    public Task DeleteSelectionAsync(string key, CancellationToken token) { Selections.Remove(key); return Task.CompletedTask; }
    public Task AttributeAsync(string key, AccountReference account, CancellationToken token)
    {
        foreach (var asset in Assets.Values.Where(x => x.OwnerKey == key).ToArray())
            Assets[asset.Id] = asset with { AccountIssuer = account.Issuer, AccountSubject = account.Subject };
        return Task.CompletedTask;
    }
    public Task UnpublishAsync(string key, CancellationToken token) { Targets[key] = Targets[key] with { IsPublic = false }; return Task.CompletedTask; }
}
