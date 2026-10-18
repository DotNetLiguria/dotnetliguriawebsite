using Microsoft.AspNetCore.Diagnostics;

namespace DotNetLiguriaCore.Security;

public sealed class SafeExceptionHandler(ILogger<SafeExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError("Request failed with type {FailureType}; correlation {TraceId}.",
            exception.GetType().Name, context.TraceIdentifier);
        var status = exception is BadHttpRequestException badRequest
            ? badRequest.StatusCode : StatusCodes.Status500InternalServerError;
        await Results.Problem(statusCode: status,
            title: status >= 500 ? "Request failed" : "Invalid request",
            extensions: new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier })
            .ExecuteAsync(context);
        return true;
    }
}
