using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Notifications;

public interface IConsentHistoryStore
{
    Task AppendAsync(ConsentHistoryEntry entry, CancellationToken cancellationToken);
    Task SetStatusAsync(ConsentHistoryEntry entry, string status, CancellationToken cancellationToken);
    Task<IReadOnlyList<ConsentHistoryEntry>> PendingAsync(AccountReference account, string purpose, CancellationToken cancellationToken);
    Task<IReadOnlyList<ConsentHistoryEntry>> ReadAsync(AccountReference account, int offset, int limit, CancellationToken cancellationToken);
}
