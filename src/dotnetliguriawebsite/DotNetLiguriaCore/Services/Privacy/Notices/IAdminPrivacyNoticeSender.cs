namespace DotNetLiguriaCore.Services.Privacy.Notices;

public interface IAdminPrivacyNoticeSender
{
    Task<PrivacyNoticeSendResult> SendAsync(CancellationToken cancellationToken);
}
