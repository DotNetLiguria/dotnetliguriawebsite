using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterPrivacyStore(INewsletterStore store) : INewsletterPrivacyStore
{
    public IReadOnlyList<string> CollectionNames { get; } =
    [
        MongoNewsletterStore.NewslettersCollectionName,
        MongoNewsletterStore.TemplatesCollectionName,
        MongoNewsletterStore.RevisionsCollectionName,
        MongoNewsletterStore.ImagesCollectionName,
        MongoNewsletterStore.SnapshotsCollectionName,
        MongoNewsletterStore.AttemptsCollectionName,
        MongoNewsletterStore.ConfirmationsCollectionName
    ];

    public Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account,
        CancellationToken cancellationToken = default) =>
        store.ExportAccountDataAsync(account.Issuer, account.Subject, cancellationToken);

    public Task EraseAsync(AccountReference account, CancellationToken cancellationToken = default) =>
        store.EraseAccountDataAsync(account.Issuer, account.Subject, cancellationToken);

    public Task<IReadOnlyList<string>> InspectAsync(AccountReference account,
        CancellationToken cancellationToken = default) =>
        store.InspectAccountDataAsync(account.Issuer, account.Subject, cancellationToken);
}
