using System.Security.Claims;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class ActiveAccountAuthenticationTests
{
    private const string _issuer = "https://identity.example.test/realms/synthetic";

    [Theory]
    [InlineData("enabled", false)]
    [InlineData("disabled", true)]
    [InlineData("deleted", true)]
    public async Task CryptographicallyValidTokensCannotOutliveDisabledOrDeletedAccounts(string state, bool rejected)
    {
        var identities = new FakeIdentityAccountAdmin();
        if (state != "deleted")
            identities.Accounts["synthetic-subject"] = new IdentityAccount
            {
                Id = "synthetic-subject", Enabled = state == "enabled",
            };
        using var services = Provider(identities);
        var context = Context(services);
        await ActiveAccountAuthentication.ValidateAsync(context);
        Assert.Equal(rejected, context.Result?.Failure is not null);
    }

    [Fact]
    public async Task IdentityOutageIsAnExplicit503WithoutLeakingExceptionsOrTreatingTokensAsValid()
    {
        using var services = Provider(new FakeIdentityAccountAdmin { FailLookup = true });
        var context = Context(services);
        context.Response.Body = new MemoryStream();
        await ActiveAccountAuthentication.ValidateAsync(context);
        Assert.NotNull(context.Result?.Failure);
        var challenge = new JwtBearerChallengeContext(context.HttpContext, context.Scheme,
            context.Options, new AuthenticationProperties());
        await ActiveAccountAuthentication.ChallengeAsync(challenge);
        Assert.Equal(503, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var body = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        Assert.Contains("identity_verification_unavailable", body);
        Assert.DoesNotContain("synthetic-private-error", body);
    }

    [Fact]
    public async Task OrdinaryChallengeReturnsJson401RatherThanAnOidcRedirect()
    {
        using var services = Provider(new FakeIdentityAccountAdmin());
        var context = Context(services);
        context.Response.Body = new MemoryStream();
        var challenge = new JwtBearerChallengeContext(context.HttpContext, context.Scheme,
            context.Options, new AuthenticationProperties());
        await ActiveAccountAuthentication.ChallengeAsync(challenge);
        Assert.Equal(401, context.Response.StatusCode);
        Assert.Equal("Bearer", context.Response.Headers.WWWAuthenticate);
        Assert.StartsWith("application/problem+json", context.Response.ContentType);
        Assert.False(context.Response.Headers.ContainsKey("Location"));
    }

    private static ServiceProvider Provider(FakeIdentityAccountAdmin identities)
    {
        var services = new ServiceCollection().AddLogging().AddProblemDetails();
        services.Configure<PrivacyOptions>(options => options.Issuer = _issuer);
        services.AddSingleton<IIdentityAccountAdmin>(identities);
        services.AddSingleton<PrivacyOperationGate>();
        return services.BuildServiceProvider();
    }

    private static TokenValidatedContext Context(IServiceProvider services) => new(
        new DefaultHttpContext { RequestServices = services },
        new AuthenticationScheme("Bearer", null, typeof(JwtBearerHandler)), new JwtBearerOptions())
    {
        Principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("iss", _issuer), new Claim("sub", "synthetic-subject")], "Bearer")),
    };
}
