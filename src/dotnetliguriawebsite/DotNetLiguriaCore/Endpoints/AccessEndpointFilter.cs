using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Endpoints;

public sealed class AccessEndpointFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "no-store, private";
        context.HttpContext.Response.Headers.Pragma = "no-cache";
        try
        {
            return await next(context);
        }
        catch (PrivacyBlockedException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode, title: "Access operation unavailable or blocked",
                extensions: new Dictionary<string, object?> { ["code"] = exception.Code });
        }
        catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested)
        {
            return Results.StatusCode(499);
        }
        catch (BadHttpRequestException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode, title: "Invalid access request",
                extensions: new Dictionary<string, object?> { ["code"] = "invalid_access_request" });
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or
            System.Text.Json.JsonException or IOException or UnauthorizedAccessException or MongoException)
        {
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Access operation could not be verified",
                extensions: new Dictionary<string, object?> { ["code"] = "access_dependency_unavailable" });
        }
    }
}
