using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Authorization;

public class WebDevAdminHandler(IOptions<WebDevAdminAuthorizationOptions> options)
    : AuthorizationHandler<WebDevAdminRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, WebDevAdminRequirement requirement)
    {
        if (IsWebDevAdmin(context.User, options.Value))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }

    public static bool IsWebDevAdmin(ClaimsPrincipal user, WebDevAdminAuthorizationOptions options) =>
        AdminClaimMatcher.IsAuthorized(user, options.AdminRole, options.AdminClaim);
}
