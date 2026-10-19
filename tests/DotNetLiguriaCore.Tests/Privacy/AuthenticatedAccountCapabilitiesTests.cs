using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class AuthenticatedAccountCapabilitiesTests
{
    private const string _issuer = "https://identity.example.test/realms/synthetic";

    [Theory]
    [InlineData(true, 200, 200, true)]
    [InlineData(false, 200, 200, false)]
    [InlineData(true, 401, 401, false)]
    [InlineData(true, 503, 503, false)]
    public async Task SignedBearerTokenReturnsCapabilitiesWithoutIdentityAdminCredentials(
        bool admin, int identityStatus, int expectedStatus, bool expected)
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AuthServer:ClientId"] = "synthetic-client",
            ["AuthServer:Audience"] = "synthetic-audience",
            ["AuthServer:Authority"] = _issuer,
            ["AuthServer:MetadataAddress"] = _issuer + "/.well-known/openid-configuration",
            ["Privacy:Issuer"] = _issuer,
            ["Privacy:AllowedIdentityHost"] = "identity.example.test"
        });
        foreach (var method in new[] { "ConfigureAuthentication", "ConfigureAuthorization" })
            typeof(DotNetLiguriaCore.Program).GetMethod(method, BindingFlags.NonPublic | BindingFlags.Static)!
                .Invoke(null, [builder.Services, builder.Configuration]);
        builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment);
        builder.Services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory("events.read"));
        using var client = new HttpClient(new PrivacyHttpHandler(request =>
        {
            Assert.Equal(_issuer + "/protocol/openid-connect/userinfo", request.RequestUri!.AbsoluteUri);
            Assert.NotNull(request.Headers.Authorization);
            return new HttpResponseMessage((HttpStatusCode)identityStatus)
            {
                Content = JsonContent.Create(new { sub = "synthetic-subject" })
            };
        }));
        builder.Services.AddSingleton(provider => new KeycloakActiveAccountVerifier(client,
            provider.GetRequiredService<IOptions<PrivacyOptions>>()));
        var key = new SymmetricSecurityKey(Enumerable.Repeat((byte)42, 32).ToArray());
        builder.Services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Configuration = new OpenIdConnectConfiguration { Issuer = _issuer };
            options.Configuration.SigningKeys.Add(key);
        });
        await using var app = builder.Build();
        app.MapAccountEndpoints();
        using var scope = app.Services.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<IOptions<PrivacyOptions>>().Value;
        Assert.Empty(settings.AdminClientId);
        Assert.Empty(settings.AdminClientSecret);
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _issuer, Audience = "synthetic-audience",
            Claims = new Dictionary<string, object> { ["sub"] = "synthetic-subject", ["permissions"] = admin ? new[] { "events.read" } : Array.Empty<string>() },
            IssuedAt = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            NotBefore = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            Expires = new DateTime(2100, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        });
        var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        context.Request.Headers.Authorization = "Bearer " + token;
        context.Response.Body = new MemoryStream();
        var authentication = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        if (expectedStatus != 200)
        {
            Assert.False(authentication.Succeeded);
            await context.ChallengeAsync(JwtBearerDefaults.AuthenticationScheme);
            Assert.Equal(expectedStatus, context.Response.StatusCode);
            return;
        }
        Assert.True(authentication.Succeeded, authentication.Failure?.GetType().Name);
        context.User = Assert.IsType<ClaimsPrincipal>(authentication.Principal);
        var endpoint = Assert.Single(((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints).OfType<RouteEndpoint>());
        await endpoint.RequestDelegate!(context);
        Assert.Equal(200, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(expected, body.RootElement.GetProperty("canAccessAdmin").GetBoolean());
    }
}
