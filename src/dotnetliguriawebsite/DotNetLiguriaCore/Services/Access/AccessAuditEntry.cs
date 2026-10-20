using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessAuditEntry(
    [property: JsonIgnore] string Id,
    DateTimeOffset At,
    string Action,
    string Permission,
    [property: JsonIgnore] string ActorIssuer,
    string ActorSubject,
    [property: JsonIgnore] string TargetIssuer,
    string TargetSubject,
    string Outcome,
    string CorrelationId,
    string? GroupId = null);
