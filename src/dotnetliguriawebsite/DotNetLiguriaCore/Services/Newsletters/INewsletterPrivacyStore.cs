using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Newsletters;

public interface INewsletterPrivacyStore
{
    IReadOnlyList<string> CollectionNames { get; }
    Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account, CancellationToken cancellationToken = default);
    Task EraseAsync(AccountReference account, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> InspectAsync(AccountReference account, CancellationToken cancellationToken = default);
}
