using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Endpoints;

public sealed class ActiveAccountWriteFilter(
    PrivacyOperationGate gate, PrivacyCoordinator privacy, IOptions<PrivacyOptions> options) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        if (HttpMethods.IsGet(context.HttpContext.Request.Method) || HttpMethods.IsHead(context.HttpContext.Request.Method))
            return await next(context);
        using var lease = await gate.EnterAsync(context.HttpContext.RequestAborted);
        await privacy.EnsureAccountActiveAsync(
            AccountReference.FromPrincipal(context.HttpContext.User, options.Value.Issuer),
            context.HttpContext.RequestAborted);
        return await next(context);
    }
}
