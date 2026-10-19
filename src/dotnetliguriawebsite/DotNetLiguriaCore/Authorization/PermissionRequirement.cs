using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
