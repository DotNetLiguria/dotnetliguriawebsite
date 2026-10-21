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
}
