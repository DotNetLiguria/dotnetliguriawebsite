using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Authorization;

// Accepts the configured realm/client-scoped role or a dedicated Boolean privilege claim.
public class FeedbackAdminHandler(IOptions<QuestionnaireAuthorizationOptions> options)
    : AuthorizationHandler<FeedbackAdminRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, FeedbackAdminRequirement requirement)
    {
        if (IsFeedbackAdmin(context.User, options.Value))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }

    public static bool IsFeedbackAdmin(ClaimsPrincipal user, QuestionnaireAuthorizationOptions options) =>
        AdminClaimMatcher.IsAuthorized(user, options.AdminRole, options.AdminClaim);
}
