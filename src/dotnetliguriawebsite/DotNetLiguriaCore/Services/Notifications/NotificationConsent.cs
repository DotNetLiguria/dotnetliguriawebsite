using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Notifications;

public sealed record NotificationConsent(string Purpose, string Version, DateTimeOffset GrantedAt)
{
    public static string AttributeFor(string purpose) => purpose switch
    {
        "monthly-upcoming-events" => "dnl_notifications_monthly",
        "event-announcements" => "dnl_notifications_events",
        _ => throw new PrivacyBlockedException("unsupported_notification_purpose", StatusCodes.Status400BadRequest)
    };

    public static bool HasCurrentConsent(IdentityAccount profile, string purpose, string version)
    {
        var attribute = AttributeFor(purpose);
        if (!profile.CanReceiveNotifications || string.IsNullOrWhiteSpace(version) ||
            !profile.Attributes.TryGetValue(attribute, out var values) || values.Length != 1) return false;
        try
        {
            var consent = JsonSerializer.Deserialize<NotificationConsent>(values[0]);
            return consent is not null && consent.Purpose == purpose && consent.Version == version &&
                consent.GrantedAt != default;
        }
        catch (JsonException) { return false; }
    }
}
