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

    [Fact]
    public async Task ProductionMessageRoundTripsUnicodeReplyToAndEmbeddedImage()
    {
        var snapshot = Snapshot();
        snapshot.Subject = "Novità e attività";
        snapshot.PlainText = "Programma: città e comunità";
        snapshot.Html = "<p>Programma: città e comunità</p><img src=\"cid:logo@newsletter\">";
        var options = Options();
        options.ReplyToAddress = "reply@example.test";
        using var message = NewsletterRenderer.BuildMessage(snapshot, options,
            "distribution@example.test", false, "attempt@example.test");
        await using var stream = new MemoryStream();
        await message.WriteToAsync(stream, TestContext.Current.CancellationToken);
        stream.Position = 0;
        using var parsed = await MimeMessage.LoadAsync(stream, TestContext.Current.CancellationToken);

        Assert.Equal(snapshot.Subject, parsed.Subject);
        Assert.Equal("attempt@example.test", parsed.MessageId);
        Assert.Equal("reply@example.test", Assert.Single(parsed.ReplyTo.Mailboxes).Address);
        Assert.Equal(snapshot.PlainText, parsed.GetTextBody(TextFormat.Plain));
        Assert.Equal(snapshot.Html, parsed.GetTextBody(TextFormat.Html));
        var image = Assert.Single(parsed.BodyParts.OfType<MimePart>(), part => part.ContentId == "logo@newsletter");
        Assert.Equal("image/png", image.ContentType.MimeType);
        await using var decoded = new MemoryStream();
        await Assert.IsAssignableFrom<IMimeContent>(image.Content)
            .DecodeToAsync(decoded, TestContext.Current.CancellationToken);
        Assert.Equal(snapshot.Images[0].Data, decoded.ToArray());
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
