using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

public static class AdministrativeReadAuthorization
{
    public static async Task<bool> HasAdministrativeReadAccessAsync(
        this HttpContext httpContext,
        IAuthorizationService authorizationService)
    {
        var authentication = await httpContext.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        var permission = PermissionRoutes.ReadPermission(httpContext.Request.Path.Value ?? "");
        return authentication.Succeeded &&
            authentication.Principal is { } principal &&
            permission is not null &&
            (await authorizationService.AuthorizeAsync(
                principal,
                policyName: permission)).Succeeded;
    }
}
