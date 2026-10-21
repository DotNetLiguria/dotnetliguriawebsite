using DotNetLiguriaCore.Services.Newsletters;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterRestoreGuardTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "newsletter-guard-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public async Task RestorePermanentlyInvalidatesEachUsedGenerationAndAllowsOnlyAFreshOne()
    {
        var (guard, options, _) = Create();
        Assert.True(guard.IsGenerationActive("generation"));
        await guard.SuspendForRestoreAsync(TestContext.Current.CancellationToken);
        Assert.False(guard.IsGenerationActive("generation"));
        options.CurrentValue.ActivationGeneration = "second";
        Assert.True(guard.IsGenerationActive("second"));
        await guard.SuspendForRestoreAsync(TestContext.Current.CancellationToken);
        options.CurrentValue.ActivationGeneration = "generation";
        Assert.False(guard.IsGenerationActive("generation"));
        options.CurrentValue.ActivationGeneration = "third";
        Assert.True(guard.IsGenerationActive("third"));
    }

    [Fact]
    public async Task UncertainProductionClaimsBlockRestoreBeforeWritingItsMarker()
    {
        var (guard, _, store) = Create();
        store.Newsletters[Guid.NewGuid()] = new NewsletterDocument { ProductionStatus = "unknown" };
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            guard.SuspendForRestoreAsync(TestContext.Current.CancellationToken));
        Assert.Equal("newsletter_pending_reconciliation", error.Code);
        Assert.False(Directory.Exists(_root));
    }

    [Fact]
    public async Task UnreadableMarkerFailsClosed()
    {
        var (guard, options, _) = Create();
        Directory.CreateDirectory(options.CurrentValue.OperationalFolder);
        await File.WriteAllTextAsync(Path.Combine(options.CurrentValue.OperationalFolder,
            "newsletter-suspended-generations.json"), "invalid JSON", TestContext.Current.CancellationToken);
        Assert.False(guard.IsGenerationActive("generation"));
    }

    [Fact]
    public async Task PublicOrAncestorOperationalStorageIsRejected()
    {
        var (guard, options, _) = Create();
        options.CurrentValue.OperationalFolder = _root;
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            guard.SuspendForRestoreAsync(TestContext.Current.CancellationToken));
        Assert.Equal("newsletter_operational_folder_must_be_private", error.Code);
    }

    private (NewsletterRestoreGuard Guard, NewsletterTestOptions Options, FakeNewsletterStore Store) Create()
    {
        var store = new FakeNewsletterStore();
        var options = new NewsletterTestOptions();
        options.CurrentValue.OperationalFolder = Path.Combine(_root, "operations");
        var environment = new NewsletterTestEnvironment { ContentRootPath = Path.Combine(_root, "website") };
        return (new NewsletterRestoreGuard(store, options, environment,
            NullLogger<NewsletterRestoreGuard>.Instance), options, store);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }
}
