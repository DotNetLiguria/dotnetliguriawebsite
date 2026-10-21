using MimeKit;

namespace DotNetLiguriaCore.Services.Newsletters;

public interface INewsletterSmtpTransport
{
    Task<NewsletterTransportResult> SendAsync(MimeMessage message, string recipient, NewsletterOptions options,
        CancellationToken cancellationToken);
}
