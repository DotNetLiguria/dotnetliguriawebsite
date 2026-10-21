using System.Net;
using DotNetLiguriaCore.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class SecurityBoundaryTests
{
    [Theory]
    [InlineData("/api/Privacy/export", true)]
    [InlineData("/api/Notifications/subscription", true)]
    [InlineData("/api/Questionnaire", true)]
    [InlineData("/api/newsletters", true)]
    [InlineData("/api/newsletters/config", true)]
    [InlineData("/api/newsletter-templates", true)]
    [InlineData("/authentication/callback", true)]
    [InlineData("/index.html", false)]
    [InlineData("/assets/app.js", false)]
    public async Task HeadersCoverPublicAndPrivateResponses(string path, bool privateResponse)
    {
        using var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        var response = new StartingResponseFeature();
        context.Features.Set<IHttpResponseFeature>(response);
        context.Request.Path = path;
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask,
            new HostingEnvironment { EnvironmentName = Environments.Production });
        await middleware.InvokeAsync(context);
        await response.StartAsync();
        Assert.Equal("nosniff", context.Response.Headers.XContentTypeOptions);
        Assert.Equal("SAMEORIGIN", context.Response.Headers.XFrameOptions);
        Assert.Contains("script-src 'self';", context.Response.Headers.ContentSecurityPolicy.ToString());
        Assert.Contains("img-src 'self' data: blob: https:;", context.Response.Headers.ContentSecurityPolicy.ToString());
        Assert.DoesNotContain("unsafe-eval", context.Response.Headers.ContentSecurityPolicy.ToString());
        Assert.Equal(privateResponse ? "no-store" : "", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task OversizedJsonIsRejectedWithoutSkippingHeadersOrCallingEndpoint()
    {
        using var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        var response = new StartingResponseFeature();
        context.Features.Set<IHttpResponseFeature>(response);
        context.Request.Path = "/api/Questionnaire";
        context.Request.ContentType = "application/json";
        context.Request.ContentLength = 1024 * 1024 + 1;
        var called = false;
        var middleware = new SecurityHeadersMiddleware(_ => { called = true; return Task.CompletedTask; },
            new HostingEnvironment { EnvironmentName = Environments.Production });
        await middleware.InvokeAsync(context);
        await response.StartAsync();
        Assert.False(called);
        Assert.Equal(413, context.Response.StatusCode);
        Assert.Equal("nosniff", context.Response.Headers.XContentTypeOptions);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OnlyConfiguredProxyCanSetClientAddressAndScheme(bool trusted)
    {
        var config = new ConfigurationManager();
        if (trusted) config["Security:KnownProxies:0"] = "192.0.2.10";
        var options = new ForwardedHeadersOptions();
        ProxyConfiguration.Configure(options, config);
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("192.0.2.10");
        context.Request.Scheme = "http";
        context.Request.Headers["X-Forwarded-For"] = "198.51.100.25";
        context.Request.Headers["X-Forwarded-Proto"] = "https";
        var middleware = new ForwardedHeadersMiddleware(_ => Task.CompletedTask,
            NullLoggerFactory.Instance, Options.Create(options));
        await middleware.Invoke(context);
        Assert.Equal(trusted ? "https" : "http", context.Request.Scheme);
        Assert.Equal(trusted ? "198.51.100.25" : "192.0.2.10", context.Connection.RemoteIpAddress?.ToString());
    }
}
