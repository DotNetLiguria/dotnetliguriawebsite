using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class MailKitSmtpProtocolTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task SendReportsAcceptanceOrRecipientRejectionWithoutNetwork(bool accept)
    {
        var responses = "220 smtp.example.test ready\r\n" +
            "250 smtp.example.test\r\n" +
            "250 sender accepted\r\n" +
            (accept ? "250 recipient accepted\r\n354 send message\r\n250 queued\r\n" : "550 recipient rejected\r\n");
        using var stream = new ScriptedSmtpStream(responses);
        using var client = new SmtpClient();
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse("sender@example.test"));
        message.To.Add(MailboxAddress.Parse("recipient@example.test"));
        message.Subject = "Test";
        message.Body = new TextPart("plain") { Text = "Body" };
        var cancellationToken = TestContext.Current.CancellationToken;

        await client.ConnectAsync(stream, "smtp.example.test", 25, SecureSocketOptions.None, cancellationToken);
        if (accept)
            await client.SendAsync(message, cancellationToken);
        else
            await Assert.ThrowsAsync<SmtpCommandException>(() => client.SendAsync(message, cancellationToken));

        Assert.Contains("MAIL FROM:<sender@example.test>", stream.Commands, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("RCPT TO:<recipient@example.test>", stream.Commands, StringComparison.OrdinalIgnoreCase);
        if (accept)
            Assert.Contains("DATA\r\n", stream.Commands, StringComparison.OrdinalIgnoreCase);
        else
            Assert.DoesNotContain("DATA\r\n", stream.Commands, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthenticationRequiredResponseIsRecognizedWithoutSubmittingMessage()
    {
        using var stream = new ScriptedSmtpStream(
            "220 smtp.example.test ready\r\n250 smtp.example.test\r\n530 Authentication required\r\n");
        using var client = new SmtpClient();
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse("sender@example.test"));
        message.To.Add(MailboxAddress.Parse("recipient@example.test"));
        message.Subject = "Test";
        message.Body = new TextPart("plain") { Text = "Body" };
        var cancellationToken = TestContext.Current.CancellationToken;

        await client.ConnectAsync(stream, "smtp.example.test", 25, SecureSocketOptions.None, cancellationToken);
        await Assert.ThrowsAnyAsync<ServiceNotAuthenticatedException>(() => client.SendAsync(message, cancellationToken));

        Assert.DoesNotContain("DATA\r\n", stream.Commands, StringComparison.OrdinalIgnoreCase);
    }
}
