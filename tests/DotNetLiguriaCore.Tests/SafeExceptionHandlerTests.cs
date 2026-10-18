using DotNetLiguriaCore.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class SafeExceptionHandlerTests
{
    [Theory]
    [InlineData(500)]
    [InlineData(413)]
    public async Task ErrorsExposeOnlyCorrelationAndPreserveHttpRejectionsWithoutLoggingPrivateDetails(int status)
    {
        using var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services, TraceIdentifier = "synthetic-correlation" };
        context.Response.Body = new MemoryStream();
        var logger = new CapturingLogger<SafeExceptionHandler>();
        Exception exception = status == 413
            ? new BadHttpRequestException("synthetic-private-details", 413)
            : new InvalidOperationException("synthetic-private-details");
        Assert.True(await new SafeExceptionHandler(logger).TryHandleAsync(context, exception,
            TestContext.Current.CancellationToken));
        Assert.Equal(status, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        Assert.Contains("synthetic-correlation", body);
        Assert.DoesNotContain("synthetic-private-details", body);
        Assert.DoesNotContain("synthetic-private-details", Assert.Single(logger.Messages));
        Assert.Null(Assert.Single(logger.Exceptions));
    }
}
