using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

public sealed class PermissionHandler(PermissionEvaluator evaluator, IHttpContextAccessor accessor)
    : AuthorizationHandler<PermissionRequirement>
{
    private readonly PermissionEvaluator _evaluator = evaluator;
    private readonly IHttpContextAccessor _accessor = accessor;

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        try
        {
            if ((await _evaluator.GetAsync(context.User, _accessor.HttpContext?.RequestAborted ?? default))
                .Contains(requirement.Permission))
                context.Succeed(requirement);
        }
        catch (PrivacyBlockedException exception)
        {
            if (_accessor.HttpContext is { } http)
                http.Items[typeof(PermissionHandler)] = exception;
            context.Fail();
        }
    }
}
