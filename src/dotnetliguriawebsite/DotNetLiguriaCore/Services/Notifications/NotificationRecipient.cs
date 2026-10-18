namespace DotNetLiguriaCore.Services.Notifications;

// Transient provider-bound value. Do not persist, log, serialize to a preview, or include in backups.
public sealed class NotificationRecipient(string email, string unsubscribeToken)
{
    public string Email { get; } = email;
    public string UnsubscribeToken { get; } = unsubscribeToken;
    public override string ToString() => "[notification recipient redacted]";
}
