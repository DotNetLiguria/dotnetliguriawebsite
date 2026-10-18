namespace DotNetLiguriaCore.Services.Privacy;

public sealed class PrivacyOperationGate
{
    public static PrivacyOperationGate Shared { get; } = new();
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public async ValueTask<IDisposable> EnterAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        return new PrivacyOperationLease(_semaphore);
    }
}
