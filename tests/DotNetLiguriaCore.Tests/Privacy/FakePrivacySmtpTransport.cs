using DotNetLiguriaCore.Services.Privacy.Notices;
using MimeKit;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakePrivacySmtpTransport : IPrivacySmtpTransport
{
    public int Calls { get; private set; }
    public string? MessageText { get; private set; }
    public PrivacyNoticeSendResult Result { get; set; } = new(true, null);
    public bool Cancel { get; set; }

    public Task<PrivacyNoticeSendResult> SendAsync(MimeMessage message, PrivacySmtpOptions options,
        CancellationToken cancellationToken)
    {
        Calls++;
        MessageText = message.ToString();
        return Cancel ? Task.FromCanceled<PrivacyNoticeSendResult>(new CancellationToken(true)) :
            Task.FromResult(Result);
    }
}
