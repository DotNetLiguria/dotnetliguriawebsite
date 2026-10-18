using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Endpoints;

public static class AccountEndpointMappings
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/account/capabilities", async (HttpContext context, IAuthorizationService authorization) =>
        {
            async Task<bool> Allowed(string policy) => (await authorization.AuthorizeAsync(context.User, policy)).Succeeded;
            return Results.Ok(new
            {
                websiteAdmin = await Allowed(WebDevAdminAuthorizationOptions.PolicyName),
                feedbackAdmin = await Allowed(QuestionnaireAuthorizationOptions.PolicyName),
                backupAdmin = await Allowed(BackupAuthorizationOptions.PolicyName),
                privacyAdmin = await Allowed("PrivacyAdministrator"),
                notificationAdmin = await Allowed("NotificationAdministrator")
            });
        }).RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<PrivacyEndpointFilter>();
        return endpoints;
    }
}
