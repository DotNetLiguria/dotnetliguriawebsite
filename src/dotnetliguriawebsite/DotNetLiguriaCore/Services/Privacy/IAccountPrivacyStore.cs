using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Privacy;

public interface IAccountPrivacyStore
{
    Task<IReadOnlyList<string>> InspectAsync(AccountReference account, CancellationToken cancellationToken);
    Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account, CancellationToken cancellationToken);
    Task EraseAsync(AccountReference account, CancellationToken cancellationToken);
}
