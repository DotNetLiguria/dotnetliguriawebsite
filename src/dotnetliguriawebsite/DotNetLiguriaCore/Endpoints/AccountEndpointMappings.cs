using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Endpoints;

public static class AccountEndpointMappings
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/account/capabilities", async (HttpContext context, PermissionEvaluator evaluator) =>
        {
            var permissions = await evaluator.GetAsync(context.User, context.RequestAborted);
            return Results.Ok(new
            {
                schemaVersion = 1,
                permissions = permissions.Order(StringComparer.Ordinal).ToArray(),
                canAccessAdmin = PermissionCatalog.CanEnterAdmin(permissions),
            });
        }).RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<PrivacyEndpointFilter>();
        return endpoints;
    }
}
