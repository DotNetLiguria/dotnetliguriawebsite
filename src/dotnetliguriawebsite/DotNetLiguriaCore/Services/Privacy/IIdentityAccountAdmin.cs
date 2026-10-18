namespace DotNetLiguriaCore.Services.Privacy;

public interface IIdentityAccountAdmin
{
    Task<IdentityAccount?> GetAsync(AccountReference account, CancellationToken cancellationToken);
    Task DisableAsync(AccountReference account, CancellationToken cancellationToken);
    Task DeleteAsync(AccountReference account, CancellationToken cancellationToken);
    Task SetConsentAsync(AccountReference account, string purpose, string? evidence, CancellationToken cancellationToken);
    IAsyncEnumerable<IdentityAccount> ListAsync(CancellationToken cancellationToken);
}
