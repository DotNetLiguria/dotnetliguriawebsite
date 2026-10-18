using DotNetLiguriaCore.Services.Privacy.Notices;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakeAdminPrivacyNoticeSender : IAdminPrivacyNoticeSender
{
    public int Calls { get; private set; }
    public Func<CancellationToken, Task<PrivacyNoticeSendResult>> Send { get; set; } =
        _ => Task.FromResult(new PrivacyNoticeSendResult(true, null));

    public Task<PrivacyNoticeSendResult> SendAsync(CancellationToken cancellationToken)
    {
        Calls++;
        return Send(cancellationToken);
    }
}
