namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterServiceException(string code, int statusCode, string? detail = null) : Exception(code)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
    public string? Detail { get; } = detail;
}
