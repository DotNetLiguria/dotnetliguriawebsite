using Microsoft.Extensions.Options;
using MimeKit;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed class AdminPrivacyNoticeSender(
    IOptionsMonitor<PrivacySmtpOptions> options,
    IPrivacySmtpTransport transport,
    TimeProvider clock) : IAdminPrivacyNoticeSender
{
    public async Task<PrivacyNoticeSendResult> SendAsync(CancellationToken cancellationToken)
    {
        var configuration = options.CurrentValue;
        var error = configuration.ConfigurationErrorCode();
        if (error is not null) return new(false, error);
        using var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(configuration.Sender));
        foreach (var recipient in configuration.AdministratorRecipients.Distinct(StringComparer.OrdinalIgnoreCase))
            message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = "Richieste privacy: intervento amministrativo richiesto";
        message.Body = new TextPart("plain")
        {
            Text = "Alcune richieste privacy richiedono un intervento amministrativo.\n" +
                "Accedere alla dashboard riservata:\n" + configuration.DashboardUrl
        };
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30), clock);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
        try
        {
            return await transport.SendAsync(message, configuration, linked.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new(false, "smtp_timeout");
        }
    }
}
