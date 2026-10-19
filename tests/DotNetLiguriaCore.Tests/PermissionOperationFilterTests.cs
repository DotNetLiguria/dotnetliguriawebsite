using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PermissionOperationFilterTests
{
    [Theory]
    [InlineData("/api/privacy/admin/retention")]
    [InlineData("/API/PRIVACY/ADMIN/RETENTION/")]
    public async Task ResourceChecksUseMatchedMetadataNotCallerPathCasing(string requestPath)
    {
        await using var services = new ServiceCollection()
            .AddSingleton<TimeProvider>(new FixedAuthorizationClock(DateTimeOffset.UnixEpoch))
            .BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Path = requestPath;
        context.Request.Method = "PUT";
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask,
            RoutePatternFactory.Parse("/api/privacy/admin/retention"), 0, new EndpointMetadataCollection(), "retention"));
        var writes = 0;
        var result = await new PermissionOperationFilter().InvokeAsync(
            new DefaultEndpointFilterInvocationContext(context), _ =>
            {
                writes++;
                return ValueTask.FromResult<object?>(Results.NoContent());
            });
        Assert.Equal(403, Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode);
        Assert.Equal(0, writes);
    }
}
