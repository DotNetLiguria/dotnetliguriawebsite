using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class PrivacyEndpointFilter : IEndpointFilter
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
            return Results.Problem(statusCode: exception.StatusCode, title: "Operation unavailable or blocked",
                extensions: new Dictionary<string, object?> { ["code"] = exception.Code });
        }
        catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested)
        {
            return Results.StatusCode(499);
        }
        catch (BadHttpRequestException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode, title: "Invalid request");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or
            System.Text.Json.JsonException or System.Security.Cryptography.CryptographicException or
            IOException or UnauthorizedAccessException or MongoDB.Driver.MongoException)
        {
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Operation incomplete; retry or request administrator recovery",
                extensions: new Dictionary<string, object?> { ["code"] = "privacy_dependency_unavailable" });
        }
    }
}
