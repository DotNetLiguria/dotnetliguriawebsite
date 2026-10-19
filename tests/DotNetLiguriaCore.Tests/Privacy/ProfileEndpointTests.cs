using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class ProfileEndpointTests
{
    private const string _issuer = "https://identity.example.test/realms/synthetic";
    private static readonly SymmetricSecurityKey _key = new(Enumerable.Repeat((byte)42, 32).ToArray());

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    public async Task BearerOnlyProfileRoutesForwardCallerTokenWithoutLocalDataStores(string method)
    {
        string? forwardedToken = null;
        using var http = new HttpClient(new PrivacyHttpHandler(request =>
        {
            forwardedToken = request.Headers.Authorization!.Parameter;
            return request.Method == HttpMethod.Post ? new HttpResponseMessage(HttpStatusCode.NoContent)
                : new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(new
                    {
                        id = "synthetic-subject", firstName = "Name", lastName = "Surname",
                        username = "synthetic", email = "synthetic@example.test", emailVerified = true
                    })
                };
        }));
        await using var app = CreateApp(http);
        var token = CreateToken();
        var context = await ContextAsync(app, token, method, """{"firstName":"Name","lastName":"Surname"}""");
        var endpoint = Endpoint(app, method);
        Assert.Contains(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(), data => data.AuthenticationSchemes == "Bearer");
        await endpoint.RequestDelegate!(context);

        Assert.Equal(200, context.Response.StatusCode);
        Assert.Equal(token, forwardedToken);
        Assert.Equal("no-store, private", context.Response.Headers.CacheControl.ToString());
        context.Response.Body.Position = 0;
        using var result = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(new[] { "email", "emailVerified", "firstName", "lastName" },
            result.RootElement.EnumerateObject().Select(property => property.Name).Order().ToArray());
        Assert.Equal("synthetic@example.test", result.RootElement.GetProperty("email").GetString());
    }

    [Theory]
    [InlineData("id", "\"other-account\"")]
    [InlineData("emailVerified", "true")]
    [InlineData("attributes", "{\"roles\":[\"admin\"]}")]
    [InlineData("email", "\"new@example.test\"")]
    public async Task HttpBindingRejectsUnapprovedFieldsBeforeAnyUpstreamRequest(string property, string value)
    {
        using var http = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("Must not forward")));
        await using var app = CreateApp(http);
        var body = "{\"firstName\":\"Name\",\"lastName\":\"Surname\",\"" + property + "\":" + value + "}";
        var context = await ContextAsync(app, CreateToken(), "PUT", body);
        await Endpoint(app, "PUT").RequestDelegate!(context);
        Assert.Equal(400, context.Response.StatusCode);
    }

    [Fact]
    public async Task RejectedKeycloakRequestHasSanitizedErrorAndNoCacheHeaders()
    {
        using var http = new HttpClient(new PrivacyHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden)
        {
            Content = new StringContent("private-upstream-details")
        }));
        await using var app = CreateApp(http);
        var context = await ContextAsync(app, CreateToken(), "GET", "");
        await Endpoint(app, "GET").RequestDelegate!(context);
        Assert.Equal(403, context.Response.StatusCode);
        Assert.Equal("no-store, private", context.Response.Headers.CacheControl.ToString());
        context.Response.Body.Position = 0;
        using var result = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal("profile_edit_forbidden", result.RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain("private-upstream-details", result.RootElement.ToString());
    }

    private static WebApplication CreateApp(HttpClient http)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Privacy:Issuer"] = _issuer, ["Privacy:AllowedIdentityHost"] = "identity.example.test"
        });
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.SaveToken = true;
            options.Configuration = new OpenIdConnectConfiguration { Issuer = _issuer };
            options.Configuration.SigningKeys.Add(_key);
            options.TokenValidationParameters.ValidIssuer = _issuer;
            options.TokenValidationParameters.ValidAudience = "synthetic-audience";
        });
        builder.Services.AddAuthorization();
        builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment);
        builder.Services.AddSingleton<IErasureJournal>(new MemoryErasureJournal());
        builder.Services.AddSingleton(provider => new KeycloakProfileClient(http,
            provider.GetRequiredService<IOptions<PrivacyOptions>>(), new PrivacyOperationGate(),
            provider.GetRequiredService<IErasureJournal>()));
        var app = builder.Build();
        app.MapPrivacyEndpoints();
        return app;
    }

    private static string CreateToken() => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = _issuer, Audience = "synthetic-audience",
        Claims = new Dictionary<string, object> { ["sub"] = "synthetic-subject" },
        IssuedAt = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        NotBefore = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        Expires = new DateTime(2100, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        SigningCredentials = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256)
    });

    private static async Task<DefaultHttpContext> ContextAsync(WebApplication app, string token, string method, string body)
    {
        var context = new DefaultHttpContext { RequestServices = app.Services };
        context.RequestAborted = TestContext.Current.CancellationToken;
        context.Request.Method = method;
        context.Request.Headers.Authorization = "Bearer " + token;
        if (method == "PUT")
        {
            context.Features.Set<IHttpRequestBodyDetectionFeature>(new ProfileRequestBodyFeature());
            context.Request.ContentType = "application/json";
            context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
            context.Request.ContentLength = context.Request.Body.Length;
        }
        context.Response.Body = new MemoryStream();
        var auth = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        Assert.True(auth.Succeeded);
        context.User = auth.Principal!;
        return context;
    }

    private static RouteEndpoint Endpoint(WebApplication app, string method) =>
        Assert.Single(((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).OfType<RouteEndpoint>(),
            endpoint => endpoint.RoutePattern.RawText == "/api/privacy/profile" &&
                endpoint.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Contains(method));
}
