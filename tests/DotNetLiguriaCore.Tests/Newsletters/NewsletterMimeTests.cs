using DotNetLiguriaCore.Services.Newsletters;
using MimeKit;
using MimeKit.Text;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterMimeTests
{
    [Fact]
    public async Task TestMessageHasOneMarkedRecipientAndRelatedCidImages()
    {
        var message = NewsletterRenderer.BuildMessage(Snapshot(), Options(),
            "editor@example.test", test: true, "attempt@example.test");
        await using var stream = new MemoryStream();
        await message.WriteToAsync(stream, CancellationToken.None);
        stream.Position = 0;
        var parsed = await MimeMessage.LoadAsync(stream, CancellationToken.None);

        Assert.Equal("[TEST] Subject", parsed.Subject);
        Assert.Single(parsed.To.Mailboxes);
        Assert.Equal("editor@example.test", parsed.To.Mailboxes.Single().Address);
        Assert.Empty(parsed.Cc);
        Assert.Empty(parsed.Bcc);
        Assert.Equal("Plain body", parsed.GetTextBody(TextFormat.Plain));
        Assert.Equal("multipart/alternative", parsed.Body!.ContentType.MimeType);
        var related = Assert.IsType<MultipartRelated>(((Multipart)parsed.Body).Last());
        Assert.Equal("logo@newsletter", related.OfType<MimePart>()
            .Single(part => part.ContentId == "logo@newsletter").ContentId);
    }

    [Fact]
    public void ProductionMessageUsesOnlyConfiguredDistributionRecipientWithoutTestMarker()
    {
        var options = Options();
        options.DistributionAddress = "distribution@example.test";
        var message = NewsletterRenderer.BuildMessage(Snapshot(), options,
            options.DistributionAddress, test: false, "attempt@example.test");

        Assert.Equal("Subject", message.Subject);
        Assert.Single(message.To.Mailboxes);
        Assert.Equal("distribution@example.test", message.To.Mailboxes.Single().Address);
        Assert.Empty(message.Cc);
        Assert.Empty(message.Bcc);
    }

    private static NewsletterSnapshotDocument Snapshot() => new()
    {
        Subject = "Subject",
        Html = "<div><img src=\"cid:logo@newsletter\" alt=\"logo\"></div>",
        PlainText = "Plain body",
        Images =
        [
            new NewsletterSnapshotImage
            {
                Cid = "logo@newsletter",
                ContentType = "image/png",
                Data = [1, 2, 3],
                Digest = "digest"
            }
        ]
    };

    private static NewsletterOptions Options() => new()
    {
        SenderAddress = "sender@example.test",
        SenderName = "DotNetLiguria"
    };
}
