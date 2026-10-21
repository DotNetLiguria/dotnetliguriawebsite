using DotNetLiguriaCore.Services.Newsletters;
using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Endpoints;

public sealed class NewsletterExceptionFilter(ILogger<NewsletterExceptionFilter> logger) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            return await next(context);
        }
        catch (NewsletterServiceException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode,
                detail: exception.Detail,
                title: exception.StatusCode >= 500 ? "Newsletter operation failed" : "Newsletter request rejected",
                extensions: new Dictionary<string, object?> { ["code"] = exception.Code });
        }
        catch (PrivacyBlockedException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode, title: "Newsletter operation blocked",
                extensions: new Dictionary<string, object?> { ["code"] = exception.Code });
        }
        catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested)
        {
            return Results.StatusCode(499);
        }
        catch (Exception exception) when (exception is MongoException or IOException or
            UnauthorizedAccessException or OperationCanceledException)
        {
            logger.LogWarning("Newsletter dependency unavailable; failure type {FailureType}.", exception.GetType().Name);
            return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Newsletter dependency unavailable",
                extensions: new Dictionary<string, object?> { ["code"] = "newsletter_dependency_unavailable" });
        }
    }
}
