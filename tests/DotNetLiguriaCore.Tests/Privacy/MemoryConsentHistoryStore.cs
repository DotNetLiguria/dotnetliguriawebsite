using DotNetLiguriaCore.Services.Notifications;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class MemoryConsentHistoryStore : IConsentHistoryStore
{
    public List<ConsentHistoryEntry> Entries { get; } = [];
    public bool FailAppend { get; set; }
    public bool FailCompletion { get; set; }

    public Task AppendAsync(ConsentHistoryEntry entry, CancellationToken cancellationToken)
    {
        if (FailAppend) throw new IOException("synthetic history failure");
        Entries.Add(entry);
        return Task.CompletedTask;
    }

    public Task SetStatusAsync(ConsentHistoryEntry entry, string status, CancellationToken cancellationToken)
    {
        if (FailCompletion) throw new IOException("synthetic completion failure");
        var index = Entries.FindIndex(item => item.Id == entry.Id);
        Entries[index] = entry with { Status = status };
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ConsentHistoryEntry>> PendingAsync(AccountReference account, string purpose, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ConsentHistoryEntry>>(Entries.Where(entry => entry.AccountIssuer == account.Issuer &&
            entry.AccountSubject == account.Subject && entry.Purpose == purpose && entry.Status == "pending").ToArray());

    public Task<IReadOnlyList<ConsentHistoryEntry>> ReadAsync(AccountReference account, int offset, int limit, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ConsentHistoryEntry>>(Entries.Where(entry => entry.AccountIssuer == account.Issuer &&
            entry.AccountSubject == account.Subject).OrderByDescending(entry => entry.OccurredAt)
            .ThenByDescending(entry => entry.Id, StringComparer.Ordinal).Skip(offset).Take(limit).ToArray());
}
