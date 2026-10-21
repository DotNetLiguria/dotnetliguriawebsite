using DotNetLiguriaCore.Services.Newsletters;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class FakeNewsletterRestoreGuard : INewsletterRestoreGuard
{
    public Task SuspendForRestoreAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public bool IsGenerationActive(string generation) => true;
}
