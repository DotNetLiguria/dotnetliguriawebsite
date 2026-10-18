using MongoDB.Driver;

namespace DotNetLiguriaCore.Tests;

public sealed class BufferedTestCursor<T>(IEnumerable<T> documents) : IAsyncCursor<T>
{
    private bool _read;
    public IEnumerable<T> Current => documents;
    public void Dispose() { }
    public bool MoveNext(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (_read) return false;
        _read = true;
        return true;
    }
    public Task<bool> MoveNextAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(MoveNext(cancellationToken));
}
