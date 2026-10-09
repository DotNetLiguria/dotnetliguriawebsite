using System.Reflection;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class AuthenticationConfigurationTests
{
    [Fact]
    public void JwtUsesTheCurrentUnmappedHandlerAndRetainsValidationSafeguards()
    {
        using var provider = CreateProvider();
        var options = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>()
            .Get(JwtBearerDefaults.AuthenticationScheme);

        Assert.False(options.MapInboundClaims);
        Assert.False(options.UseSecurityTokenValidators);
        var handler = Assert.IsType<JsonWebTokenHandler>(Assert.Single(options.TokenHandlers));
        Assert.False(handler.MapInboundClaims);
        Assert.True(options.TokenValidationParameters.ValidateIssuer);
        Assert.True(options.TokenValidationParameters.ValidateAudience);
        Assert.True(options.TokenValidationParameters.ValidateLifetime);
        Assert.True(options.TokenValidationParameters.RequireSignedTokens);
        Assert.Equal("synthetic-audience", options.TokenValidationParameters.ValidAudience);
        Assert.Equal("https://identity.example.test/realms/synthetic", options.Authority);
        Assert.Equal(TimeSpan.FromMinutes(5), options.TokenValidationParameters.ClockSkew);
    }

    [Fact]
    public void CookieAndOidcKeepSchemesSecureCookiesPkceAndProviderCompatibility()
    {
        using var provider = CreateProvider();
        var authentication = provider.GetRequiredService<IOptions<AuthenticationOptions>>().Value;
        var cookie = provider.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var oidc = provider.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>()
            .Get(OpenIdConnectDefaults.AuthenticationScheme);

        Assert.Equal(CookieAuthenticationDefaults.AuthenticationScheme, authentication.DefaultAuthenticateScheme);
        Assert.Equal(CookieAuthenticationDefaults.AuthenticationScheme, authentication.DefaultSignInScheme);
        Assert.Equal(OpenIdConnectDefaults.AuthenticationScheme, authentication.DefaultChallengeScheme);
        Assert.Equal(CookieSecurePolicy.Always, cookie.Cookie.SecurePolicy);
        Assert.Equal(SameSiteMode.None, cookie.Cookie.SameSite);
        Assert.True(oidc.UsePkce);
        Assert.True(oidc.SaveTokens);
        Assert.False(oidc.MapInboundClaims);
        Assert.Equal("code", oidc.ResponseType);
        Assert.Equal("/signin-oidc", oidc.CallbackPath.Value);
        Assert.Equal("/signout-remote/", oidc.RemoteSignOutPath.Value);
        Assert.Equal(PushedAuthorizationBehavior.Disable, oidc.PushedAuthorizationBehavior);
    }

    private static ServiceProvider CreateProvider()
    {
        var configuration = new ConfigurationManager();
        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AuthServer:ClientId"] = "synthetic-client",
            ["AuthServer:Audience"] = "synthetic-audience",
            ["AuthServer:Authority"] = "https://identity.example.test/realms/synthetic",
            ["AuthServer:MetadataAddress"] = "https://identity.example.test/realms/synthetic/.well-known/openid-configuration"
        });
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        var configure = typeof(DotNetLiguriaCore.Program).GetMethod("ConfigureAuthentication",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(configure);
        configure.Invoke(null, [services, configuration]);
        return services.BuildServiceProvider();
    }
}