using System.Security.Cryptography;
using DotNetLiguriaCore.Services.Newsletters;
using MimeKit;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterRenderingTests
{
    [Fact]
    public async Task PreparedMarkdownPreservesMapLinksAndEmbedsEveryImageIncludingTheTopLogo()
    {
        var store = new FakeNewsletterStore();
        var options = new NewsletterTestOptions();
        var environment = new NewsletterTestEnvironment();
        var bytes = await File.ReadAllBytesAsync(Path.Combine(environment.StoragePaths.ContentsRoot,
            "newsletters", "dotnetliguria-logo.png"), TestContext.Current.CancellationToken);
        var imageId = Guid.NewGuid();
        store.Images[imageId] = new NewsletterImageDocument
        {
            Id = imageId, Data = bytes, ContentType = "image/png",
            Digest = Convert.ToHexString(SHA256.HashData(bytes))
        };
        var renderer = new NewsletterRenderer(store, options, environment, new NewsletterTestClock(), environment.StoragePaths);
        var newsletter = Draft($"[Mappa](https://maps.example.test/?a=1&b=2)\n\n![Poster](newsletter-image:{imageId:D})");

        var snapshot = await renderer.PrepareAsync(newsletter, TestContext.Current.CancellationToken);
        Assert.Equal(2, snapshot.Images.Count);
        Assert.StartsWith("<table", snapshot.Html);
        Assert.Contains("cid:dotnetliguria-logo", snapshot.Html);
        Assert.Contains($"cid:{imageId:N}@newsletter", snapshot.Html);
        Assert.DoesNotContain("newsletter-image:", snapshot.Html);
        Assert.DoesNotContain("<img src=\"https:", snapshot.Html);
        Assert.Contains("https://maps.example.test/?a=1&b=2", snapshot.PlainText);
        using var message = NewsletterRenderer.BuildMessage(snapshot, options.CurrentValue,
            "tester@example.test", true, "test@example.test");
        Assert.Equal(2, message.BodyParts.OfType<MimePart>().Count(part => !string.IsNullOrEmpty(part.ContentId)));
        Assert.True(snapshot.MessageBytes > bytes.Length);
    }

    [Theory]
    [InlineData("![remote](https://example.test/image.png)", "remote_images_not_allowed")]
    [InlineData("![remote](//example.test/image.png)", "remote_images_not_allowed")]
    [InlineData("![inline](data:image/png;base64,aGVsbG8=)", "remote_images_not_allowed")]
    [InlineData("![cid](cid:arbitrary)", "remote_images_not_allowed")]
    [InlineData("{{event.title}}", "unresolved_template_placeholder")]
    public async Task UnsafeOrUnresolvedMarkdownFailsExplicitly(string markdown, string code)
    {
        var environment = new NewsletterTestEnvironment();
        var renderer = new NewsletterRenderer(new FakeNewsletterStore(), new NewsletterTestOptions(),
            environment, new NewsletterTestClock(), environment.StoragePaths);
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            renderer.PrepareAsync(Draft(markdown), TestContext.Current.CancellationToken));
        Assert.Equal(code, error.Code);
    }

    [Fact]
    public async Task ACorruptStoredImageCannotBeAcceptedAsTestedContent()
    {
        var store = new FakeNewsletterStore();
        var id = Guid.NewGuid();
        store.Images[id] = new NewsletterImageDocument
        {
            Id = id, Data = [1, 2, 3], ContentType = "image/png", Digest = "incorrect"
        };
        var environment = new NewsletterTestEnvironment();
        var renderer = new NewsletterRenderer(store, new NewsletterTestOptions(),
            environment, new NewsletterTestClock(), environment.StoragePaths);
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            renderer.PrepareAsync(Draft($"![Poster](newsletter-image:{id:D})"), TestContext.Current.CancellationToken));
        Assert.Equal("newsletter_image_integrity_failed", error.Code);
    }

    [Fact]
    public async Task StarterEventTemplateValidatesAndIncludesAllRequestedEventFields()
    {
        var environment = new NewsletterTestEnvironment();
        var markdown = await File.ReadAllTextAsync(Path.Combine(environment.StoragePaths.ContentsRoot,
            "newsletters", "event-body.md"), TestContext.Current.CancellationToken);
        var engine = new NewsletterTemplateEngine();
        engine.Validate(markdown, true);
        foreach (var token in new[]
        {
            "event.date", "event.startTime", "event.endTime", "event.location.name",
            "event.location.address", "event.location.mapUrl", "event.talksMarkdown"
        })
            Assert.Contains("{{" + token + "}}", markdown);
    }

    private static NewsletterDocument Draft(string markdown) => new()
    {
        Id = Guid.NewGuid(), Title = "Draft", Subject = "Subject", Markdown = markdown
    };
}
