namespace DotNetLiguriaCore.Services.Notifications;

public sealed record NotificationSubscriptionRequest(string Purpose, string Version, bool OptIn);
