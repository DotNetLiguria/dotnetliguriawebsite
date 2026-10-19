using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
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
    [InlineData("", false)]
    [InlineData("dnl-webdevadmin", false)]
    [InlineData("feedbackadmin", false)]
    [InlineData("board-member", false)]
    public async Task UnscopedRoleClaimsDoNotGrantAdministrativeCapabilities(string role, bool expected) =>
        await AssertCapabilitiesAsync(new(ClaimTypes.Role, role), expected);

    [Theory]
    [InlineData("dnl-webdevadmin", "true", true)]
    [InlineData("dnl-webdevadmin", "True", true)]
    [InlineData("dnl-webdevadmin", "false", false)]
    [InlineData("dnl-webdevadmin", "False", false)]
    [InlineData("dnl-webdevadmin", "", false)]
    [InlineData("dnl-webdevadmin", "1", false)]
    [InlineData("dnl-webdevadmin", "dnl-webdevadmin", false)]
    [InlineData("realm_access", "{\"roles\":[\"dnl-webdevadmin\"]}", true)]
    [InlineData("resource_access", "{\"DotNetLiguriaCore\":{\"roles\":[\"dnl-webdevadmin\"]}}", true)]
    [InlineData("resource_access", "{\"other-client\":{\"roles\":[\"dnl-webdevadmin\"]}}", false)]
    [InlineData("roles", "[\"dnl-webdevadmin\"]", false)]
    [InlineData("roles0", "dnl-webdevadmin", false)]
    public async Task BooleanClaimAndKeycloakRolesAreEvaluatedByTheSamePolicyAsWebsiteApis(string type, string value, bool expected) =>
        await AssertCapabilitiesAsync(new(type, value), expected);

    [Fact]
    public async Task ActualJwtBooleanClaimGrantsWebsiteAdministration()
    {
        var handler = new Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler();
        var token = handler.CreateToken(new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object> { ["dnl-webdevadmin"] = true }
        });
        var claim = Assert.Single(handler.ReadJsonWebToken(token).Claims, claim => claim.Type == "dnl-webdevadmin");
        Assert.Equal("true", claim.Value);
        await AssertCapabilitiesAsync(claim, true);
    }

    [Fact]
    public async Task DotNetBooleanClaimGrantsWebsiteAdministration() =>
        await AssertCapabilitiesAsync(new Claim("dnl-webdevadmin", bool.TrueString, ClaimValueTypes.Boolean), true);

    private static async Task AssertCapabilitiesAsync(Claim claim, bool expected, bool feedbackAdmin = false)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.Configure<WebDevAdminAuthorizationOptions>(_ => { });
        builder.Services.Configure<QuestionnaireAuthorizationOptions>(_ => { });
        builder.Services.Configure<BackupAuthorizationOptions>(_ => { });
        builder.Services.AddSingleton<IAuthorizationHandler, WebDevAdminHandler>();
        builder.Services.AddSingleton<IAuthorizationHandler, FeedbackAdminHandler>();
        builder.Services.AddSingleton<IAuthorizationHandler, BackupAdminHandler>();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy(WebDevAdminAuthorizationOptions.PolicyName, policy => policy.AddRequirements(new WebDevAdminRequirement()))
            .AddPolicy(QuestionnaireAuthorizationOptions.PolicyName, policy => policy.AddRequirements(new FeedbackAdminRequirement()))
            .AddPolicy(BackupAuthorizationOptions.PolicyName, policy => policy.AddRequirements(new BackupAdminRequirement()))
            .AddPolicy("PrivacyAdministrator", policy => policy.RequireRole("privacyadmin"))
            .AddPolicy("NotificationAdministrator", policy => policy.RequireRole("notificationadmin"));
        await using var app = builder.Build();
        app.MapAccountEndpoints();
        var endpoint = Assert.Single(((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>());
        Assert.Contains(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(), data => data.AuthenticationSchemes == "Bearer");
        var context = new DefaultHttpContext
        {
            RequestServices = app.Services,
            User = new ClaimsPrincipal(new ClaimsIdentity([claim], "Bearer"))
        };
        context.Response.Body = new MemoryStream();
        await endpoint.RequestDelegate!(context);
        context.Response.Body.Position = 0;
        using var result = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(expected, result.RootElement.GetProperty("websiteAdmin").GetBoolean());
        Assert.Equal(feedbackAdmin, result.RootElement.GetProperty("feedbackAdmin").GetBoolean());
        Assert.False(result.RootElement.GetProperty("privacyAdmin").GetBoolean());
        Assert.False(result.RootElement.GetProperty("backupAdmin").GetBoolean());
        Assert.Contains("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.DoesNotContain("example.test", result.RootElement.ToString());
    }
}
