namespace DotNetLiguriaCore.Services.Notifications;

public sealed record ConsentHistoryEntry(
    string Id, string AccountIssuer, string AccountSubject, string Purpose,
    string Version, DateTimeOffset OccurredAt, string Action, string Status)
{
    public string? Evidence => Action == "grant"
        ? System.Text.Json.JsonSerializer.Serialize(new NotificationConsent(Purpose, Version, OccurredAt))
        : null;
}
