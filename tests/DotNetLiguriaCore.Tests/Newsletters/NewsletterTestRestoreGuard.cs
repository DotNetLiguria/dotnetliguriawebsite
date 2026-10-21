using DotNetLiguriaCore.Services.Newsletters;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestRestoreGuard : INewsletterRestoreGuard
{
    public Task SuspendForRestoreAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    public bool IsGenerationActive(string generation) => generation == "generation";
}
