namespace DotNetLiguriaCore.Services.Access;

public sealed record PermissionAssignmentSnapshot(
    IReadOnlySet<string> DirectPermissions,
    IReadOnlySet<string> InheritedPermissions,
    IReadOnlySet<string> EffectivePermissions);
