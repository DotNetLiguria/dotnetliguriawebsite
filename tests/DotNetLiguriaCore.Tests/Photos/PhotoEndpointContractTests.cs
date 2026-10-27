using System.Text.Json;
using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Photos;

public sealed class PhotoEndpointContractTests
{
    [Fact]
    public async Task Personal_and_editor_routes_require_bearer_not_cookies()
    {
        await using var app = CreateApp();
        var routes = Endpoints(app).ToArray();
        Assert.Equal(13, routes.Length);
        foreach (var route in routes.Where(x => x.RoutePattern.RawText!.StartsWith("/api/photos/", StringComparison.Ordinal)))
            Assert.Contains(route.Metadata.GetOrderedMetadata<IAuthorizeData>(), x => x.AuthenticationSchemes == "Bearer");
        var media = Assert.Single(routes, x => x.RoutePattern.RawText!.StartsWith("/api/media/", StringComparison.Ordinal));
        Assert.NotNull(media.Metadata.GetMetadata<IAllowAnonymous>());
        Assert.Equal(["GET", "HEAD"], media.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods);
    }

    [Fact]
    public async Task Ordinary_attendee_can_read_own_photo_without_dashboard_permissions()
    {
        await using var app = CreateApp();
        var context = await InvokeAsync(app, "/api/photos/account", "GET");
        Assert.Equal(200, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal("legacy", json.RootElement.GetProperty("version").GetString());
        Assert.False(json.RootElement.TryGetProperty("accountSubject", out _));
        Assert.Equal("no-store, private", context.Response.Headers.CacheControl);
    }

    [Theory]
    [InlineData("board")]
    [InlineData("speaker")]
    public async Task Personal_photo_suggestions_use_current_identity_not_spoofed_claims(string sourceScope)
    {
        var store = new FakePhotoStore();
        var id = Guid.NewGuid();
        var key = $"{sourceScope}:{id:D}";
        store.Targets[key] = new(key, "Grace Lovelace", "https://images.example/photo.jpg", true, null);
        var permission = sourceScope == "board" ? "board.read" : "speakers.read";
        await using var app = CreateApp(store: store, permissions: [permission]);
        var context = await InvokeAsync(app, "/api/photos/account", "GET", permissions: [permission]);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(key, Assert.Single(json.RootElement.GetProperty("candidates").EnumerateArray()).GetProperty("key").GetString());
        Assert.False(json.RootElement.TryGetProperty("email", out _));
    }

    [Fact]
    public async Task Personal_photo_suggestions_do_not_expose_linked_photos_without_dashboard_access()
    {
        var store = new FakePhotoStore();
        var key = PhotoTarget.BoardKey(Guid.NewGuid());
        store.Targets[key] = new(key, "Ada Lovelace", "https://images.example/photo.jpg", true,
            new(TestPermissionDirectory.Issuer, "synthetic-subject"));
        await using var app = CreateApp(store: store);
        var context = await InvokeAsync(app, "/api/photos/account", "GET");
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(json.RootElement.GetProperty("candidates").EnumerateArray());
    }

    [Fact]
    public async Task Personal_photo_suggestions_ignore_name_and_email_claims_that_match_another_person()
    {
        var store = new FakePhotoStore();
        var key = PhotoTarget.SpeakerKey(Guid.NewGuid());
        store.Targets[key] = new(key, "Wrong Person", "https://images.example/photo.jpg", true, null)
        {
            Email = "wrong@example.test"
        };
        await using var app = CreateApp(store: store, permissions: ["speakers.read"]);
        var context = await InvokeAsync(app, "/api/photos/account", "GET", permissions: ["speakers.read"]);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Empty(json.RootElement.GetProperty("candidates").EnumerateArray());
    }

    [Fact]
    public async Task Personal_photo_suggestions_can_match_current_identity_email_without_matching_name()
    {
        var store = new FakePhotoStore();
        var key = PhotoTarget.BoardKey(Guid.NewGuid());
        store.Targets[key] = new(key, "Different Name", "https://images.example/photo.jpg", true, null)
        {
            Email = " ADA@EXAMPLE.TEST "
        };
        await using var app = CreateApp(store: store, permissions: ["board.read"]);
        var context = await InvokeAsync(app, "/api/photos/account", "GET", permissions: ["board.read"]);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(key, Assert.Single(json.RootElement.GetProperty("candidates").EnumerateArray()).GetProperty("key").GetString());
    }

    [Theory]
    [InlineData("board")]
    [InlineData("speaker")]
    public async Task Editorial_photo_routes_reject_attendees_without_domain_manage(string scope)
    {
        await using var app = CreateApp();
        var context = await InvokeAsync(app, $"/api/photos/{scope}/{{id:guid}}", "GET", Guid.NewGuid());
        Assert.Equal(403, context.Response.StatusCode);
    }

    [Fact]
    public async Task Account_in_erasure_cannot_access_or_recreate_photo()
    {
        var journal = new MemoryErasureJournal();
        await journal.SaveAsync(new ErasureOperation("test-operation",
            new(TestPermissionDirectory.Issuer, "synthetic-subject"), "requested"), TestContext.Current.CancellationToken);
        await using var app = CreateApp(journal);
        var context = await InvokeAsync(app, "/api/photos/account", "GET");
        Assert.Equal(409, context.Response.StatusCode);
    }

    [Theory]
    [InlineData("select")]
    [InlineData("upload")]
    public async Task Photo_mutations_require_controller_storage_approval(string action)
    {
        await using var app = CreateApp();
        var context = await InvokeAsync(app, $"/api/photos/account/{action}", "POST",
            body: action == "select" ? """{"version":"legacy","source":"none"}""" : null);
        Assert.Equal(503, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal("protected_storage_not_approved", json.RootElement.GetProperty("code").GetString());
    }

    private static WebApplication CreateApp(MemoryErasureJournal? journal = null, FakePhotoStore? store = null, string[]? permissions = null)
    {
        var builder = WebApplication.CreateSlimBuilder();
        var settings = Options.Create(new PrivacyOptions { Issuer = TestPermissionDirectory.Issuer });
        var identities = new FakeIdentityAccountAdmin();
        identities.Accounts["synthetic-subject"] = new IdentityAccount
        {
            Id = "synthetic-subject", Enabled = true, FirstName = "Ada", LastName = "Lovelace", Email = "ada@example.test"
        };
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton(settings);
        builder.Services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory(permissions ?? []));
        builder.Services.AddSingleton<IIdentityAccountAdmin>(identities);
        builder.Services.AddScoped<PermissionEvaluator>();
        builder.Services.AddSingleton<IPhotoStore>(store ?? new FakePhotoStore());
        builder.Services.AddSingleton(Options.Create(new PhotoOptions()));
        builder.Services.AddSingleton<PhotoStorage>();
        builder.Services.AddSingleton<PhotoService>();
        builder.Services.AddSingleton<PhotoLifecycle>();
        builder.Services.AddSingleton<PhotoMutationAudit>();
        var gate = new PrivacyOperationGate();
        builder.Services.AddSingleton(gate);
        builder.Services.AddSingleton(new PrivacyCoordinator(gate, journal ?? new(), new FakeAccountPrivacyStore(),
            identities, new FakePrivacySnapshotStore(), settings));
        builder.Services.AddSingleton<DotNetLiguriaCore.Services.Access.IAccessAuditStore, PhotoTestAuditStore>();
        builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
        var app = builder.Build();
        app.MapPhotoEndpoints();
        return app;
    }

    private static IEnumerable<RouteEndpoint> Endpoints(WebApplication app) =>
        ((IEndpointRouteBuilder)app).DataSources.SelectMany(x => x.Endpoints).OfType<RouteEndpoint>();

    private static async Task<DefaultHttpContext> InvokeAsync(WebApplication app, string route, string method, Guid? id = null,
        string? body = null, string[]? permissions = null)
    {
        using var scope = app.Services.CreateScope();
        var context = new DefaultHttpContext
        {
            RequestServices = scope.ServiceProvider, User = TestPermissionDirectory.Principal(
                [new Claim("name", "Wrong Person"), new Claim("email", "wrong@example.test"),
                    .. (permissions ?? []).Select(permission => new Claim("permissions", permission))]),
            RequestAborted = TestContext.Current.CancellationToken
        };
        context.Request.Method = method;
        if (body is not null)
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(body);
            context.Request.ContentType = "application/json";
            context.Request.ContentLength = bytes.Length;
            context.Request.Body = new MemoryStream(bytes);
            context.Features.Set<Microsoft.AspNetCore.Http.Features.IHttpRequestBodyDetectionFeature>(
                new ProfileRequestBodyFeature());
        }
        if (id.HasValue) context.Request.RouteValues["id"] = id.Value.ToString("D");
        context.Response.Body = new MemoryStream();
        await Assert.Single(Endpoints(app), x => x.RoutePattern.RawText == route &&
            x.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Contains(method)).RequestDelegate!(context);
        return context;
    }
}
