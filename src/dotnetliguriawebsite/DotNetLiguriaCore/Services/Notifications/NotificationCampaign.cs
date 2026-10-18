namespace DotNetLiguriaCore.Services.Notifications;

public sealed record NotificationCampaign(
    string Id, string Purpose, Guid[] EventIds, DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt, int RecipientCount, string CreatedBy, string Status);
