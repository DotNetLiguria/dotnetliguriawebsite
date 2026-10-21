using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterEndpointFailureTests
{
    [Fact]
    public async Task BlockedAccountsReceiveTheStandardPrivacyErrorWithoutPrivateDetails()
    {
        var filter = new NewsletterExceptionFilter(NullLogger<NewsletterExceptionFilter>.Instance);
        var result = await filter.InvokeAsync(
            new DefaultEndpointFilterInvocationContext(new DefaultHttpContext()),
            _ => throw new PrivacyBlockedException("account_erasure_pending", 409));
        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(409, problem.StatusCode);
        Assert.Equal("account_erasure_pending", problem.ProblemDetails.Extensions["code"]);
        Assert.Null(problem.ProblemDetails.Detail);
    }

    [Fact]
    public async Task StorageFailureIsExplicitWithoutLeakingItsPrivatePath()
    {
        var filter = new NewsletterExceptionFilter(NullLogger<NewsletterExceptionFilter>.Instance);
        var result = await filter.InvokeAsync(
            new DefaultEndpointFilterInvocationContext(new DefaultHttpContext()),
            _ => throw new IOException("private-storage-path"));
        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(503, problem.StatusCode);
        Assert.Equal("newsletter_dependency_unavailable", problem.ProblemDetails.Extensions["code"]);
        Assert.Null(problem.ProblemDetails.Detail);
    }
}
