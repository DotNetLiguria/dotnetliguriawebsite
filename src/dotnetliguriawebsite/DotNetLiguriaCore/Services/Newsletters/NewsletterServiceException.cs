namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterServiceException(string code, int statusCode) : Exception(code)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
