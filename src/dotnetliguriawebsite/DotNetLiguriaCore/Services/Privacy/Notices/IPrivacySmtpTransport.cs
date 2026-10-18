using MimeKit;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public interface IPrivacySmtpTransport
{
    Task<PrivacyNoticeSendResult> SendAsync(MimeMessage message, PrivacySmtpOptions options,
        CancellationToken cancellationToken);
}
