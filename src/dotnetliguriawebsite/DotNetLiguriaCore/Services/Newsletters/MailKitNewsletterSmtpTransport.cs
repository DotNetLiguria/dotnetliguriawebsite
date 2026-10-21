using MailKit.Net.Smtp;
using MailKit.Security;
using MailKit;
using MimeKit;
using System.Net.Sockets;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class MailKitNewsletterSmtpTransport : INewsletterSmtpTransport
{
    public async Task<NewsletterTransportResult> SendAsync(MimeMessage message, string recipient,
        NewsletterOptions options, CancellationToken cancellationToken)
    {
        if (!NewsletterOptions.IsMailbox(recipient) ||
            message.To.Count != 1 || message.Cc.Count != 0 || message.Bcc.Count != 0 ||
            message.To[0] is not MailboxAddress address ||
            !string.Equals(address.Address, recipient, StringComparison.OrdinalIgnoreCase))
            return new("not-submitted", "invalid_recipient");
        if (!options.HasSmtpConfiguration)
            return new("not-submitted", "smtp_not_configured");

        using var client = new SmtpClient
        {
            Timeout = Math.Clamp(options.SmtpTimeoutSeconds, 5, 120) * 1000,
            SslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                System.Security.Authentication.SslProtocols.Tls13,
            CheckCertificateRevocation = true
        };
        var submissionStarted = false;
        try
        {
            var socketOptions = options.SmtpUseStartTls
                ? SecureSocketOptions.StartTls
                : SecureSocketOptions.SslOnConnect;
            await client.ConnectAsync(options.SmtpHost, options.SmtpPort, socketOptions, cancellationToken);
            if (!string.IsNullOrWhiteSpace(options.SmtpUserName))
                await client.AuthenticateAsync(options.SmtpUserName, options.SmtpPassword, cancellationToken);
            submissionStarted = true;
            await client.SendAsync(message, cancellationToken);
            // Once accepted, disconnect failure must not invite a duplicate submission.
            return new("accepted");
        }
        catch (SmtpCommandException)
        {
            return new("not-submitted", "smtp_rejected");
        }
        catch (ServiceNotAuthenticatedException)
        {
            return new("not-submitted", "smtp_authentication_failed");
        }
        catch (ServiceNotConnectedException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_connection_failed");
        }
        catch (MailKit.Security.SslHandshakeException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted", "smtp_tls_failed");
        }
        catch (System.Security.Authentication.AuthenticationException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_authentication_failed");
        }
        catch (SocketException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_connection_failed");
        }
        catch (NotSupportedException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted", "smtp_tls_unavailable");
        }
        catch (OperationCanceledException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_timeout_before_submit");
        }
        catch (IOException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_connection_failed");
        }
        catch (SmtpProtocolException)
        {
            return new(submissionStarted ? "unknown" : "not-submitted",
                submissionStarted ? "smtp_result_unknown" : "smtp_protocol_failed");
        }
    }
}
