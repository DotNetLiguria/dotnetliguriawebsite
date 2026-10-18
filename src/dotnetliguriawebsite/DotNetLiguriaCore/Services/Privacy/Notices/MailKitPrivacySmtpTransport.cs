using System.Net.Sockets;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed class MailKitPrivacySmtpTransport : IPrivacySmtpTransport
{
    public async Task<PrivacyNoticeSendResult> SendAsync(MimeMessage message, PrivacySmtpOptions options,
        CancellationToken cancellationToken)
    {
        using var client = new SmtpClient
        {
            Timeout = 30000,
            SslProtocols = System.Security.Authentication.SslProtocols.Tls12 |
                System.Security.Authentication.SslProtocols.Tls13,
            CheckCertificateRevocation = true
        };
        try
        {
            await client.ConnectAsync(options.Host, options.Port,
                options.TlsMode == "SslOnConnect" ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls,
                cancellationToken);
            if (!string.IsNullOrWhiteSpace(options.UserName))
                await client.AuthenticateAsync(options.UserName, options.Password!, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            // Once accepted, a failed QUIT must not misreport the message as rejected.
            return new(true, null);
        }
        catch (SslHandshakeException) { return new(false, "smtp_tls_failed"); }
        catch (System.Security.Authentication.AuthenticationException) { return new(false, "smtp_tls_failed"); }
        catch (AuthenticationException) { return new(false, "smtp_authentication_failed"); }
        catch (MailKit.ServiceNotAuthenticatedException) { return new(false, "smtp_authentication_required"); }
        catch (MailKit.ServiceNotConnectedException) { return new(false, "smtp_connection_failed"); }
        catch (SmtpCommandException) { return new(false, "smtp_rejected"); }
        catch (SmtpProtocolException) { return new(false, "smtp_protocol_failed"); }
        catch (NotSupportedException) { return new(false, "smtp_tls_unavailable"); }
        catch (SocketException) { return new(false, "smtp_connection_failed"); }
        catch (IOException) { return new(false, "smtp_transport_failed"); }
    }
}
