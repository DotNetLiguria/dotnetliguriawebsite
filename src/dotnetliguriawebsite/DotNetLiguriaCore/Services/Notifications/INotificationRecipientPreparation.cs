namespace DotNetLiguriaCore.Services.Notifications;

public interface INotificationRecipientPreparation
{
    IAsyncEnumerable<NotificationRecipient> PrepareConfirmedRecipientsAsync(string campaignId, CancellationToken cancellationToken);
}
