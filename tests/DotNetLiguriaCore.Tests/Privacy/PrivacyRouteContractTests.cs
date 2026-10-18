using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PrivacyRouteContractTests
{
    private readonly PrivacyTestClock _clock = new();
    private readonly PrivacyOptions _settings = PrivacyCoordinatorTests.Settings();
    private readonly MemoryErasureJournal _journal = new();
    private readonly FakeIdentityAccountAdmin _identities = new();
    private readonly FakeAccountPrivacyStore _data = new();

    [Fact]
    public async Task ErasureRequiresRecentMfaAndExplicitConfirmation()
    {
        await using var app = CreateApp();
        var noMfa = await InvokeAsync(app, "/api/privacy/erase", "POST", mfa: false, confirmation: "erase-my-account");
        Assert.Equal(403, noMfa.Response.StatusCode);
        var noConfirmation = await InvokeAsync(app, "/api/privacy/erase", "POST", mfa: true);
        Assert.Equal(400, noConfirmation.Response.StatusCode);
        Assert.Empty(_journal.Operations);
        Assert.Equal(0, _data.Erasures);
    }

    [Fact]
    public async Task ManualFallbackReturnsAcceptedNotCompletedAndNoIdentity()
    {
        _settings.AutomaticIdentityDeletion = false;
        await using var app = CreateApp();
        var result = await InvokeAsync(app, "/api/privacy/erase", "POST", mfa: true, confirmation: "erase-my-account");
        Assert.Equal(202, result.Response.StatusCode);
        var json = await ReadAsync(result);
        Assert.Equal("awaiting_manual_identity_removal", json.GetProperty("status").GetString());
        Assert.DoesNotContain("immutable-subject", json.ToString());
        Assert.Equal("no-store, private", result.Response.Headers.CacheControl.ToString());
        Assert.False(_identities.Accounts["immutable-subject"].Enabled);
        Assert.Single(_journal.Operations);
    }

    [Fact]
    public async Task IdentityDetailAndManualCompletionRequireMfaAndVerifiedAbsence()
    {
        _settings.AutomaticIdentityDeletion = false;
        await using var app = CreateApp();
        await InvokeAsync(app, "/api/privacy/erase", "POST", mfa: true, confirmation: "erase-my-account");
        var id = Assert.Single(_journal.Operations.Values).Id;
        var denied = await InvokeAsync(app, "/api/privacy/admin/operations/{id}/identity", "GET", id: id);
        Assert.Equal(403, denied.Response.StatusCode);
        var detail = await InvokeAsync(app, "/api/privacy/admin/operations/{id}/identity", "GET", mfa: true, id: id);
        var identity = await ReadAsync(detail);
        Assert.Equal("immutable-subject", identity.GetProperty("subject").GetString());
        Assert.False(identity.TryGetProperty("email", out _));
        var blocked = await InvokeAsync(app, "/api/privacy/admin/operations/{id}/verify-removal", "POST",
            mfa: true, confirmation: "verify-identity-removal", id: id);
        Assert.Equal(409, blocked.Response.StatusCode);
        _identities.Accounts.Clear();
        var done = await InvokeAsync(app, "/api/privacy/admin/operations/{id}/verify-removal", "POST",
            mfa: true, confirmation: "verify-identity-removal", id: id);
        Assert.Equal(200, done.Response.StatusCode);
        Assert.Equal("completed", (await ReadAsync(done)).GetProperty("status").GetString());
        Assert.Empty(_journal.Operations);
    }

    [Fact]
    public async Task OperationListNeverExposesAccountAndNewActionsKeepPrivacyPolicy()
    {
        _settings.AutomaticIdentityDeletion = false;
        await using var app = CreateApp();
        await InvokeAsync(app, "/api/privacy/erase", "POST", mfa: true, confirmation: "erase-my-account");
        var result = await InvokeAsync(app, "/api/privacy/admin/operations", "GET");
        var body = (await ReadAsync(result)).ToString();
        Assert.Contains("notificationStatus", body);
        Assert.DoesNotContain("immutable-subject", body);
        Assert.DoesNotContain(_settings.Issuer, body);
        foreach (var endpoint in Endpoints(app).Where(endpoint => endpoint.RoutePattern.RawText!.Contains("/admin/")))
            Assert.Contains(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(), data => data.Policy == "PrivacyAdministrator");
    }

    private WebApplication CreateApp()
    {
        _identities.Accounts["immutable-subject"] = new IdentityAccount { Id = "immutable-subject", Enabled = true };
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<TimeProvider>(_clock);
        builder.Services.AddSingleton<IErasureJournal>(_journal);
        builder.Services.AddSingleton(Options.Create(_settings));
        builder.Services.AddSingleton<IRetentionPolicyStore, FileRetentionPolicyStore>();
        builder.Services.AddSingleton(new PrivacyCoordinator(new(), _journal, _data, _identities,
            new FakePrivacySnapshotStore(), Options.Create(_settings)));
        var app = builder.Build();
        app.MapPrivacyEndpoints();
        return app;
    }

    private async Task<DefaultHttpContext> InvokeAsync(WebApplication app, string route, string method,
        bool mfa = false, string? confirmation = null, string? id = null)
    {
        var claims = new List<Claim> { new("iss", _settings.Issuer), new("sub", "immutable-subject") };
        if (mfa)
        {
            claims.Add(new("acr", "mfa"));
            claims.Add(new("auth_time", _clock.Now.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture)));
        }
        var context = new DefaultHttpContext
        {
            RequestServices = app.Services, User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer"))
        };
        context.Request.Method = method;
        context.RequestAborted = TestContext.Current.CancellationToken;
        if (id is not null) context.Request.RouteValues["id"] = id;
        if (confirmation is not null) context.Request.Headers["X-Confirm-Erasure"] = confirmation;
        context.Response.Body = new MemoryStream();
        await Assert.Single(Endpoints(app), endpoint => endpoint.RoutePattern.RawText == route &&
            endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Contains(method)).RequestDelegate!(context);
        return context;
    }

    private static IEnumerable<RouteEndpoint> Endpoints(WebApplication app) =>
        ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>();

    private static async Task<JsonElement> ReadAsync(DefaultHttpContext context)
    {
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        return json.RootElement.Clone();
    }
}
