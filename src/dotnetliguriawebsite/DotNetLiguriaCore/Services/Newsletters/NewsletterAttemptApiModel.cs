namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterAttemptApiModel(
    string Id, string Mode, string? Recipient, string Status, DateTimeOffset OccurredAt,
    string? ErrorCode = null, string? MessageId = null,
    bool ReconciliationRequired = false, string? ReconciliationOutcome = null);
