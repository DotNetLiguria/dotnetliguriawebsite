namespace DotNetLiguriaCore.Services.Privacy;

public interface IErasureJournal
{
    Task<ErasureOperation?> FindAsync(AccountReference account, CancellationToken cancellationToken);
    Task<IReadOnlyList<ErasureOperation>> ListAsync(CancellationToken cancellationToken);
    Task SaveAsync(ErasureOperation operation, CancellationToken cancellationToken);
    Task RemoveAsync(ErasureOperation operation, CancellationToken cancellationToken);
}
