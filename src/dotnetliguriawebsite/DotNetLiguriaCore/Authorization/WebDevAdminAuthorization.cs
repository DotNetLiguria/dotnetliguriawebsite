using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

public static class WebDevAdminAuthorization
{
    public static async Task<bool> IsWebDevAdminAsync(
        this HttpContext httpContext,
        IAuthorizationService authorizationService)
    {
        var authentication = await httpContext.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        return authentication.Succeeded &&
            authentication.Principal is { } principal &&
            (await authorizationService.AuthorizeAsync(
                principal,
                policyName: WebDevAdminAuthorizationOptions.PolicyName)).Succeeded;
    }
}
