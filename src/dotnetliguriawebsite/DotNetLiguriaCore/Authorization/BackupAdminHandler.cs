using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Authorization;

public sealed class BackupAdminHandler(IOptions<BackupAuthorizationOptions> options)
    : AuthorizationHandler<BackupAdminRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, BackupAdminRequirement requirement)
    {
        var settings = options.Value;
        if (AdminClaimMatcher.IsAuthorized(context.User, settings.AdminRole, settings.AdminClaim))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
