using DotNetLiguriaCore.Services.Notifications;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class FakeNotificationCampaignStore : INotificationCampaignStore
{
    public Dictionary<string, NotificationCampaign> Campaigns { get; } = new();
    public Task<Guid[]> ResolveEventsAsync(NotificationCampaignRequest request, DateTimeOffset now, CancellationToken cancellationToken) =>
        Task.FromResult(new[] { Guid.Parse("00000000-0000-0000-0000-000000000001") });
    public Task SaveAsync(NotificationCampaign campaign, CancellationToken cancellationToken)
    {
        Campaigns[campaign.Id] = campaign;
        return Task.CompletedTask;
    }
    public Task<NotificationCampaign?> GetAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Campaigns.GetValueOrDefault(id));
}
