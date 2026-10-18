namespace DotNetLiguriaCore.Services.Notifications;

public sealed record NotificationCampaignRequest(string Purpose, Guid[] EventIds);
