namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessUserDetails(
    string Issuer,
    string Subject,
    string? Username,
    bool Enabled,
    IReadOnlySet<string> DirectPermissions,
    IReadOnlySet<string> InheritedPermissions,
    IReadOnlySet<string> EffectivePermissions,
    bool ProtectedTarget,
    bool IsSelf,
    bool CanGrant,
    bool CanRevoke,
    IReadOnlySet<string> GrantablePermissions,
    IReadOnlySet<string> RevocablePermissions);
