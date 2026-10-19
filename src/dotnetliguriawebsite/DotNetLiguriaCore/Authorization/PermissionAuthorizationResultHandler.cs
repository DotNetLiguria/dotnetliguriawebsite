using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace DotNetLiguriaCore.Authorization;

public sealed class PermissionAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    public async Task HandleAsync(RequestDelegate next, HttpContext context,
        AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        if (context.Items[typeof(PermissionHandler)] is PrivacyBlockedException failure)
        {
            await Results.Problem(statusCode: failure.StatusCode, title: "Authorization unavailable",
                extensions: new Dictionary<string, object?> { ["code"] = failure.Code }).ExecuteAsync(context);
            return;
        }
        if (authorizeResult.Forbidden)
        {
            await Results.Problem(statusCode: 403, title: "Permission required",
                extensions: new Dictionary<string, object?> { ["code"] = "permission_required" }).ExecuteAsync(context);
            return;
        }
        await new AuthorizationMiddlewareResultHandler().HandleAsync(next, context, policy, authorizeResult);
    }
}
