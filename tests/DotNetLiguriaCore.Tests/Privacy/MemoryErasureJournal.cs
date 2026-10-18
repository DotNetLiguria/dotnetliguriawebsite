using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class MemoryErasureJournal : IErasureJournal
{
    public Dictionary<string, ErasureOperation> Operations { get; } = new();
    public Task<ErasureOperation?> FindAsync(AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult(Operations.Values.SingleOrDefault(operation => operation.Account == account));
    public Task<IReadOnlyList<ErasureOperation>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ErasureOperation>>(Operations.Values.ToArray());
    public Task SaveAsync(ErasureOperation operation, CancellationToken cancellationToken)
    {
        Operations[operation.Id] = operation;
        return Task.CompletedTask;
    }
    public Task RemoveAsync(ErasureOperation operation, CancellationToken cancellationToken)
    {
        Operations.Remove(operation.Id);
        return Task.CompletedTask;
    }
}
