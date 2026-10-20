using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoMutationAudit(IAccessAuditStore audit, TimeProvider clock)
{
    private readonly IAccessAuditStore _audit = audit;
    private readonly TimeProvider _clock = clock;

    public async Task RunAsync(AccountReference actor, PhotoTarget target, string operation,
        Func<Task> change, CancellationToken token)
    {
        var scope = target.Key.Split(':')[0];
        var account = target.Account ?? actor;
        var entry = new AccessAuditEntry(Guid.NewGuid().ToString("N"), _clock.GetUtcNow(),
            scope + "-photo-" + operation, scope == "account" ? "" : scope == "board" ? "board.manage" : "speakers.manage",
            actor.Issuer, actor.Subject, account.Issuer, account.Subject, "intent", Guid.NewGuid().ToString("N"));
        await _audit.AppendAsync(entry, token);
        try
        {
            await change();
            await _audit.AppendAsync(entry with { Id = Guid.NewGuid().ToString("N"), At = _clock.GetUtcNow(), Outcome = "verified" }, token);
        }
        catch (Exception) when (!token.IsCancellationRequested)
        {
            await _audit.AppendAsync(entry with { Id = Guid.NewGuid().ToString("N"), At = _clock.GetUtcNow(), Outcome = "unverified" }, token);
            throw;
        }
    }
}
