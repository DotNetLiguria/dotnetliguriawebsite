using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Photos;

public interface IPhotoStore
{
    Task<PhotoTarget?> TargetAsync(string key, CancellationToken token);
    Task<IReadOnlyList<PhotoTarget>> RelatedAsync(AccountReference account, CancellationToken token);
    Task<IReadOnlyList<PhotoTarget>> SpeakerTargetsAsync(CancellationToken token);
    Task<IReadOnlyList<PhotoTarget>> BoardTargetsAsync(CancellationToken token);
    Task<IReadOnlyList<PhotoTarget>> PublicTargetsAsync(CancellationToken token);
    Task<PhotoSelection?> SelectionAsync(string key, CancellationToken token);
    Task<IReadOnlyList<PhotoSelection>> SelectionsAsync(CancellationToken token);
    Task SaveAsync(PhotoSelection selection, string expectedVersion, CancellationToken token);
    Task AddAssetAsync(PhotoAsset asset, CancellationToken token);
    Task<PhotoAsset?> AssetAsync(Guid id, CancellationToken token);
    Task<IReadOnlyList<PhotoAsset>> AssetsAsync(CancellationToken token);
    Task DeleteAssetAsync(Guid id, CancellationToken token);
    Task AttributeAsync(string key, AccountReference account, CancellationToken token);
    Task DeleteSelectionAsync(string key, CancellationToken token);
    Task UnpublishAsync(string key, CancellationToken token);
}
