namespace DotNetLiguriaCore.Services.Newsletters;

public interface INewsletterRestoreGuard
{
    Task SuspendForRestoreAsync(CancellationToken cancellationToken = default);
    bool IsGenerationActive(string generation);
}
