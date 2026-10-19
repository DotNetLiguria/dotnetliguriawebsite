using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class AccountCapabilitiesTests
{
    [Theory]
    [InlineData("dnl-webdevadmin", "true")]
    [InlineData("realm_access", "{\"roles\":[\"dnl-webdevadmin\"]}")]
    [InlineData("resource_access", "{\"DotNetLiguriaCore\":{\"roles\":[\"feedbackadmin\"]}}")]
    [InlineData("roles", "backupadmin")]
    public async Task LegacyGrantsDoNotUnlockTheDashboard(string type, string value)
    {
        var result = await CapabilitiesAsync([new Claim(type, value)]);
        Assert.False(result.GetProperty("canAccessAdmin").GetBoolean());
        Assert.Empty(result.GetProperty("permissions").EnumerateArray());
    }

    [Theory]
    [InlineData("questionnaires.manage", true)]
    [InlineData("backups.read", true)]
    [InlineData("events.past.manage", false)]
    public async Task SpecialistsDoNotNeedAnUmbrellaAdministratorRole(string permission, bool enter)
    {
        var result = await CapabilitiesAsync([new Claim("permissions", permission)], permission);
        Assert.Equal(1, result.GetProperty("schemaVersion").GetInt32());
        Assert.Equal(enter, result.GetProperty("canAccessAdmin").GetBoolean());
        Assert.Equal(permission, Assert.Single(result.GetProperty("permissions").EnumerateArray()).GetString());
        Assert.False(result.TryGetProperty("websiteAdmin", out _));
    }

    [Fact]
    public async Task AssignedButOutOfScopePermissionIsNotRestoredFromLiveDirectory()
    {
        var result = await CapabilitiesAsync([], "backups.restore");
        Assert.Empty(result.GetProperty("permissions").EnumerateArray());
    }

    private static async Task<JsonElement> CapabilitiesAsync(Claim[] claims, params string[] live)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddPermissionAuthorization();
        builder.Services.Configure<PrivacyOptions>(options => options.Issuer = TestPermissionDirectory.Issuer);
        builder.Services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory(live));
        await using var app = builder.Build();
        app.MapAccountEndpoints();
        using var scope = app.Services.CreateScope();
        var endpoint = Assert.Single(((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>());
        Assert.Contains(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(), data => data.AuthenticationSchemes == "Bearer");
        var context = new DefaultHttpContext
        {
            RequestServices = scope.ServiceProvider,
            User = TestPermissionDirectory.Principal(claims),
        };
        context.Response.Body = new MemoryStream();
        await endpoint.RequestDelegate!(context);
        context.Response.Body.Position = 0;
        using var result = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Contains("no-store", context.Response.Headers.CacheControl.ToString());
        return result.RootElement.Clone();
    }
}
