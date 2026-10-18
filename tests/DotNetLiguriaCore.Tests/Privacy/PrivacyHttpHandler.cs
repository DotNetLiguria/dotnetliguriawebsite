namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class PrivacyHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _response = response;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
        Task.FromResult(_response(request));
}
