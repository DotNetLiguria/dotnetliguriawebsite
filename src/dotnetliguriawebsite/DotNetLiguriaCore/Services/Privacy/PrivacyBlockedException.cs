namespace DotNetLiguriaCore.Services.Privacy;

public sealed class PrivacyBlockedException(string code, int statusCode = StatusCodes.Status503ServiceUnavailable) : Exception(code)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
