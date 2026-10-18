using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakeAccountPrivacyStore : IAccountPrivacyStore
{
    public string[] Blockers { get; set; } = [];
    public int Erasures { get; private set; }
    public IReadOnlyList<BsonDocument> Documents { get; set; } = [];
    public AccountReference? ExportedAccount { get; private set; }
    public Task<IReadOnlyList<string>> InspectAsync(AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<string>>(Blockers);
    public Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account, CancellationToken cancellationToken)
    {
        ExportedAccount = account;
        return Task.FromResult(Documents);
    }
    public Task EraseAsync(AccountReference account, CancellationToken cancellationToken)
    {
        Erasures++;
        return Task.CompletedTask;
    }
}
