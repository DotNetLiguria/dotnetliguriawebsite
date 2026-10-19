using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PermissionPipelineTests
{
    public static TheoryData<string> Catalogue => new(PermissionCatalog.Ids);

    [Theory]
    [MemberData(nameof(Catalogue))]
    public async Task EveryPolicyExecutesOnlyForAnAuthenticatedScopedAndLiveGrant(string permission)
    {
        Assert.Equal((200, 1), await ExecuteAsync(permission, permission, permission));
        Assert.Equal((403, 0), await ExecuteAsync(permission,
            permission == "events.past.manage" ? "events.read" : "events.past.manage", permission));
        Assert.Equal((403, 0), await ExecuteAsync(permission, permission, null));
        Assert.Equal((401, 0), await ExecuteAsync(permission, null, permission));
    }

    [Theory]
    [InlineData("https://wrong.example.test/realms/synthetic", "api")]
    [InlineData(TestPermissionDirectory.Issuer, "wrong-client")]
    public async Task WrongIssuerOrAudienceFailsBeforeSideEffects(string issuer, string audience) =>
        Assert.Equal((401, 0), await ExecuteAsync("events.manage", "events.manage", "events.manage", issuer, audience));

    [Fact]
    public async Task PermissionDirectoryOutageReturns503WithoutExecutingTheOperation() =>
        Assert.Equal((503, 0), await ExecuteAsync("events.manage", "events.manage", "events.manage",
            directoryUnavailable: true));

    private static async Task<(int Status, int Writes)> ExecuteAsync(string required, string? tokenPermission,
        string? livePermission, string issuer = TestPermissionDirectory.Issuer, string audience = "api",
        bool directoryUnavailable = false)
    {
        var services = new ServiceCollection().AddLogging().AddRouting();
        services.AddPermissionAuthorization();
        services.Configure<PrivacyOptions>(options => options.Issuer = TestPermissionDirectory.Issuer);
        services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory(livePermission is null ? [] : [livePermission])
        {
            Failure = directoryUnavailable ? new PrivacyBlockedException("permission_directory_unavailable") : null,
        });
        var key = new SymmetricSecurityKey(Enumerable.Repeat((byte)42, 32).ToArray());
        services.AddAuthentication().AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.Configuration = new OpenIdConnectConfiguration { Issuer = TestPermissionDirectory.Issuer };
            options.Configuration.SigningKeys.Add(key);
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = TestPermissionDirectory.Issuer, ValidAudience = "api",
                ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
            };
            options.Events.OnChallenge = ActiveAccountAuthentication.ChallengeAsync;
        });
        await using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var writes = 0;
        var endpoint = new Endpoint(context =>
        {
            writes++;
            context.Response.StatusCode = 200;
            return Task.CompletedTask;
        }, new EndpointMetadataCollection(new AuthorizeAttribute(required)), "synthetic write");
        var builder = new ApplicationBuilder(provider);
        builder.UseAuthentication();
        builder.UseAuthorization();
        builder.Run(endpoint.RequestDelegate!);
        var http = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        provider.GetRequiredService<IHttpContextAccessor>().HttpContext = http;
        http.SetEndpoint(endpoint);
        http.Response.Body = new MemoryStream();
        if (tokenPermission is not null)
        {
            var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
            {
                Issuer = issuer, Audience = audience,
                Claims = new Dictionary<string, object>
                {
                    ["sub"] = "synthetic-subject", ["permissions"] = new[] { tokenPermission },
                },
                NotBefore = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                Expires = new DateTime(2100, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            });
            http.Request.Headers.Authorization = "Bearer " + token;
        }
        await builder.Build()(http);
        return (http.Response.StatusCode, writes);
    }
}
