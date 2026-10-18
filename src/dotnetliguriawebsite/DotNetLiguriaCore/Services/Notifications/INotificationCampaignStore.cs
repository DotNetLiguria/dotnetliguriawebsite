namespace DotNetLiguriaCore.Services.Notifications;

public interface INotificationCampaignStore
{
    Task<Guid[]> ResolveEventsAsync(NotificationCampaignRequest request, DateTimeOffset now, CancellationToken cancellationToken);
    Task SaveAsync(NotificationCampaign campaign, CancellationToken cancellationToken);
    Task<NotificationCampaign?> GetAsync(string id, CancellationToken cancellationToken);
}
