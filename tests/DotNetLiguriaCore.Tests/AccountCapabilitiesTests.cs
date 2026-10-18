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
    [InlineData("dnl-webdevadmin", true)]
    [InlineData("feedbackadmin", false)]
    [InlineData("board-member", false)]
    public async Task CapabilitiesUseExistingPoliciesAndDoNotEquateAuthenticationOrBoardMembershipWithAdmin(string role, bool expected)
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
            User = new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.Role, role)], "Bearer"))
        };
        context.Response.Body = new MemoryStream();
        await endpoint.RequestDelegate!(context);
        context.Response.Body.Position = 0;
        using var result = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(expected, result.RootElement.GetProperty("websiteAdmin").GetBoolean());
        Assert.Equal(role == "feedbackadmin", result.RootElement.GetProperty("feedbackAdmin").GetBoolean());
        Assert.False(result.RootElement.GetProperty("privacyAdmin").GetBoolean());
        Assert.False(result.RootElement.GetProperty("backupAdmin").GetBoolean());
        Assert.Contains("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.DoesNotContain("example.test", result.RootElement.ToString());
    }
}
