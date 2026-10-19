using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Access;

public interface IAccessAuditStore
{
    Task AppendAsync(AccessAuditEntry entry, CancellationToken cancellationToken);
    Task<IReadOnlyList<AccessAuditEntry>> RecentAsync(int limit, CancellationToken cancellationToken);
    Task<IReadOnlyList<BsonDocument>> ExportAccountAsync(AccountReference account, CancellationToken cancellationToken);
    Task EraseAccountAsync(AccountReference account, CancellationToken cancellationToken);
}
