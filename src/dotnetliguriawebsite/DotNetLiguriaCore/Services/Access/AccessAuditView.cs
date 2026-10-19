namespace DotNetLiguriaCore.Services.Access;

/// <summary>
/// Audit row returned to operators. Usernames are resolved from the identity provider when the
/// history is read and are never persisted with the audit record.
/// </summary>
public sealed record AccessAuditView(
    DateTimeOffset At,
    string Action,
    string Permission,
    string ActorSubject,
    string? ActorUsername,
    string TargetSubject,
    string? TargetUsername,
    string Outcome,
    string CorrelationId);
