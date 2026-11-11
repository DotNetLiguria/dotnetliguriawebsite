using DotNetLiguriaCore.Services.Newsletters;
using MimeKit;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class MailKitNewsletterSmtpTransportTests
{
    [Fact]
    public async Task RejectsEnvelopeWithMoreThanOneRecipientBeforeConnecting()
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse("sender@example.test"));
        message.To.Add(MailboxAddress.Parse("one@example.test"));
        message.Cc.Add(MailboxAddress.Parse("two@example.test"));

        var result = await new MailKitNewsletterSmtpTransport().SendAsync(
            message, "one@example.test", new NewsletterOptions(), CancellationToken.None);

        Assert.Equal("not-submitted", result.Status);
        Assert.Equal("invalid_recipient", result.ErrorCode);
    }

    [Theory]
    [InlineData("other@example.test")]
    [InlineData("not-an-address")]
    public async Task RejectsInvalidOrMismatchedRecipientBeforeConnecting(string recipient)
    {
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse("sender@example.test"));
        message.To.Add(MailboxAddress.Parse("one@example.test"));

        var result = await new MailKitNewsletterSmtpTransport().SendAsync(
            message, recipient, new NewsletterOptions(), TestContext.Current.CancellationToken);

        Assert.Equal("not-submitted", result.Status);
        Assert.Equal("invalid_recipient", result.ErrorCode);
    }

    [Fact]
    public async Task RejectsMissingSmtpConfigurationBeforeConnecting()
    {
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse("sender@example.test"));
        message.To.Add(MailboxAddress.Parse("one@example.test"));

        var result = await new MailKitNewsletterSmtpTransport().SendAsync(
            message, "one@example.test", new NewsletterOptions(), TestContext.Current.CancellationToken);

        Assert.Equal("not-submitted", result.Status);
        Assert.Equal("smtp_not_configured", result.ErrorCode);
    }
}
