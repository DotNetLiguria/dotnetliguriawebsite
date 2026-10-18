using System.Net;
using System.Text;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class KeycloakIdentityAccountAdminTests
{
    [Fact]
    public async Task OnlyFixedRealmAndSubjectEndpointsAreUsedAndEmailIsNeverSearched()
    {
        var settings = PrivacyCoordinatorTests.Settings();
        var paths = new List<string>();
        using var client = new HttpClient(new PrivacyHttpHandler(request =>
        {
            Assert.Equal("hello.vevy.com", request.RequestUri!.Host);
            paths.Add(request.RequestUri.AbsolutePath);
            Assert.DoesNotContain("email", request.RequestUri.Query);
            return request.RequestUri.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
                ? Json(HttpStatusCode.OK, """{"access_token":"synthetic-token"}""")
                : Json(HttpStatusCode.OK, """{"id":"immutable-subject","enabled":true,"emailVerified":true,"email":"synthetic@example.test"}""");
        }));
        var service = new KeycloakIdentityAccountAdmin(client, Options.Create(settings));
        var account = await service.GetAsync(new(settings.Issuer, "immutable-subject"), TestContext.Current.CancellationToken);
        Assert.True(account!.EmailVerified);
        Assert.Equal(new[] { "/realms/test/protocol/openid-connect/token", "/admin/realms/test/users/immutable-subject" }, paths);
    }

    [Fact]
    public async Task UpstreamFailureDoesNotExposeBodiesOrCredentials()
    {
        var settings = PrivacyCoordinatorTests.Settings();
        using var client = new HttpClient(new PrivacyHttpHandler(_ => Json(HttpStatusCode.Forbidden,
            """{"error":"synthetic-private-body"}""")));
        var service = new KeycloakIdentityAccountAdmin(client, Options.Create(settings));
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.GetAsync(new(settings.Issuer, "subject"), TestContext.Current.CancellationToken));
        Assert.Equal("identity_admin_unavailable", failure.Code);
        Assert.DoesNotContain("private", failure.ToString());
        Assert.DoesNotContain(settings.AdminClientSecret, failure.ToString());
    }

    [Fact]
    public async Task MissingCredentialsFailBeforeAnyHttpRequest()
    {
        var settings = PrivacyCoordinatorTests.Settings();
        settings.AdminClientSecret = "";
        using var client = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("HTTP must not occur")));
        var service = new KeycloakIdentityAccountAdmin(client, Options.Create(settings));
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.GetAsync(new(settings.Issuer, "subject"), TestContext.Current.CancellationToken));
        Assert.Equal(503, failure.StatusCode);
    }

    [Fact]
    public async Task AlreadyDeletedAccountIsIdempotentAndForeignIssuerCannotReachHttp()
    {
        var settings = PrivacyCoordinatorTests.Settings();
        using var client = new HttpClient(new PrivacyHttpHandler(request =>
            request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
                ? Json(HttpStatusCode.OK, """{"access_token":"synthetic-token"}""")
                : Json(HttpStatusCode.NotFound, "{}")));
        var service = new KeycloakIdentityAccountAdmin(client, Options.Create(settings));
        var reference = new AccountReference(settings.Issuer, "subject");
        Assert.Null(await service.GetAsync(reference, TestContext.Current.CancellationToken));
        await service.DisableAsync(reference, TestContext.Current.CancellationToken);
        await service.DeleteAsync(reference, TestContext.Current.CancellationToken);
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.GetAsync(reference with { Issuer = "https://foreign.example/realms/test" }, TestContext.Current.CancellationToken));
        Assert.Equal(403, failure.StatusCode);
    }

    private static HttpResponseMessage Json(HttpStatusCode statusCode, string body) =>
        new(statusCode) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
}
