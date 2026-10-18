namespace DotNetLiguriaCore.Services.Privacy;

internal sealed class PrivacyOperationLease(SemaphoreSlim semaphore) : IDisposable
{
    private SemaphoreSlim? _semaphore = semaphore;
    public void Dispose() => Interlocked.Exchange(ref _semaphore, null)?.Release();
}
