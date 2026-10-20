using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Tests.Photos;

internal sealed class PhotoTestAuditStore : IAccessAuditStore
{
    public List<AccessAuditEntry> Entries { get; } = [];
    public bool FailIntent { get; set; }
    public Task AppendAsync(AccessAuditEntry entry, CancellationToken cancellationToken)
    {
        if (FailIntent && entry.Outcome == "intent") throw new IOException("Synthetic audit failure.");
        Entries.Add(entry);
        return Task.CompletedTask;
    }
    public Task<IReadOnlyList<AccessAuditEntry>> RecentAsync(int limit, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccessAuditEntry>>(Entries.Take(limit).ToArray());
    public Task<IReadOnlyList<BsonDocument>> ExportAccountAsync(AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<BsonDocument>>([]);
    public Task EraseAccountAsync(AccountReference account, CancellationToken cancellationToken) => Task.CompletedTask;
}
