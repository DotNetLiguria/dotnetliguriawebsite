using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Tests.Access;

internal sealed class FakeAccessAuditStore : IAccessAuditStore
{
    public List<AccessAuditEntry> Entries { get; } = [];
    public IReadOnlyList<BsonDocument> ExportDocuments { get; set; } = [];
    public AccountReference? ExportedAccount { get; private set; }
    public AccountReference? ErasedAccount { get; private set; }

    public Task AppendAsync(AccessAuditEntry entry, CancellationToken cancellationToken)
    {
        Entries.Add(entry);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AccessAuditEntry>> RecentAsync(int limit, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccessAuditEntry>>(Entries.OrderByDescending(entry => entry.At)
            .Take(limit).ToArray());

    public Task<IReadOnlyList<BsonDocument>> ExportAccountAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        ExportedAccount = account;
        return Task.FromResult(ExportDocuments);
    }

    public Task EraseAccountAsync(AccountReference account, CancellationToken cancellationToken)
    {
        ErasedAccount = account;
        Entries.RemoveAll(entry => entry.ActorIssuer == account.Issuer && entry.ActorSubject == account.Subject ||
            entry.TargetIssuer == account.Issuer && entry.TargetSubject == account.Subject);
        return Task.CompletedTask;
    }
}
