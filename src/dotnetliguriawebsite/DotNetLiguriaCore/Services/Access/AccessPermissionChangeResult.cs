namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessPermissionChangeResult(
    string Issuer,
    string Subject,
    IReadOnlySet<string> DirectPermissions,
    IReadOnlySet<string> InheritedPermissions,
    IReadOnlySet<string> EffectivePermissions,
    bool Changed,
    string CorrelationId);
