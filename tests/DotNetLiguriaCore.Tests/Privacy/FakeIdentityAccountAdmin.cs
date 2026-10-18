using System.Runtime.CompilerServices;
using DotNetLiguriaCore.Services.Notifications;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakeIdentityAccountAdmin : IIdentityAccountAdmin
{
    public Dictionary<string, IdentityAccount> Accounts { get; } = new();
    public bool FailDeletion { get; set; }
    public bool FailLookup { get; set; }
    public bool LeaveEnabledOnDisable { get; set; }
    public bool FailDisable { get; set; }
    public bool LoseDeleteResponse { get; set; }
    public bool FailLookupAfterDeletion { get; set; }
    public int Deletions { get; private set; }
    public Task<IdentityAccount?> GetAsync(AccountReference account, CancellationToken cancellationToken)
    {
        if (FailLookup) throw new HttpRequestException("synthetic-private-error");
        return Task.FromResult(Accounts.GetValueOrDefault(account.Subject));
    }
    public Task DisableAsync(AccountReference account, CancellationToken cancellationToken)
    {
        if (FailDisable) throw new HttpRequestException("synthetic disable failure");
        if (!LeaveEnabledOnDisable && Accounts.TryGetValue(account.Subject, out var profile)) profile.Enabled = false;
        return Task.CompletedTask;
    }
    public Task DeleteAsync(AccountReference account, CancellationToken cancellationToken)
    {
        if (FailDeletion) throw new HttpRequestException("Synthetic failure");
        Accounts.Remove(account.Subject);
        Deletions++;
        if (FailLookupAfterDeletion) FailLookup = true;
        if (LoseDeleteResponse) throw new HttpRequestException("synthetic lost response");
        return Task.CompletedTask;
    }
    public Task SetConsentAsync(AccountReference account, string purpose, string? evidence, CancellationToken cancellationToken)
    {
        var profile = Accounts[account.Subject];
        var attribute = NotificationConsent.AttributeFor(purpose);
        if (evidence is null) profile.Attributes.Remove(attribute);
        else profile.Attributes[attribute] = [evidence];
        return Task.CompletedTask;
    }
    public async IAsyncEnumerable<IdentityAccount> ListAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        foreach (var account in Accounts.Values)
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return account;
        }
        await Task.CompletedTask;
    }
}
