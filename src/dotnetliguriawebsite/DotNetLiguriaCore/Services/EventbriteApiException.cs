using System.Net;

namespace DotNetLiguriaCore.Services;

public sealed class EventbriteApiException(HttpStatusCode? statusCode, string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public HttpStatusCode? StatusCode { get; } = statusCode;
}
