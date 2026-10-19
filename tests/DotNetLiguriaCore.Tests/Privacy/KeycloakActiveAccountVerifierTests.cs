using System.Net;
using System.Net.Http.Json;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class KeycloakActiveAccountVerifierTests
{
    private const string _issuer = "https://identity.example.test/realms/synthetic";

    [Fact]
    public async Task ActiveAccountUsesOnlyTheValidatedTokenWithoutAdminCredentials()
    {
        using var client = new HttpClient(new PrivacyHttpHandler(request =>
        {
            Assert.Equal(_issuer + "/protocol/openid-connect/userinfo", request.RequestUri!.AbsoluteUri);
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal("synthetic-token", request.Headers.Authorization?.Parameter);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { sub = "synthetic-subject" })
            };
        }));
        var verifier = new KeycloakActiveAccountVerifier(client, Settings());
        Assert.True(await verifier.IsActiveAsync(new(_issuer, "synthetic-subject"),
            "synthetic-token", TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(401, false)]
    [InlineData(403, false)]
    [InlineData(302, true)]
    [InlineData(429, true)]
    [InlineData(500, true)]
    [InlineData(503, true)]
    public async Task DeniedTokensAndDependencyFailuresRemainDistinct(int status, bool dependencyFailure)
    {
        using var client = new HttpClient(new PrivacyHttpHandler(_ => new HttpResponseMessage((HttpStatusCode)status)));
        var verifier = new KeycloakActiveAccountVerifier(client, Settings());
        if (dependencyFailure)
            await Assert.ThrowsAsync<HttpRequestException>(() => verifier.IsActiveAsync(
                new(_issuer, "synthetic-subject"), "synthetic-token", TestContext.Current.CancellationToken));
        else
            Assert.False(await verifier.IsActiveAsync(new(_issuer, "synthetic-subject"),
                "synthetic-token", TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("{\"sub\":\"another-subject\"}")]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("{\"sub\":true}")]
    public async Task UserInfoMustMatchTheValidatedSubject(string json)
    {
        using var client = new HttpClient(new PrivacyHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
        }));
        Assert.False(await new KeycloakActiveAccountVerifier(client, Settings()).IsActiveAsync(
            new(_issuer, "synthetic-subject"), "synthetic-token", TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("https://foreign.example.test/realms/synthetic", "synthetic-token")]
    [InlineData(_issuer, "")]
    public async Task ForeignIssuersAndMissingTokensNeverLeaveTheProcess(string issuer, string token)
    {
        using var client = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("Unexpected network request.")));
        Assert.False(await new KeycloakActiveAccountVerifier(client, Settings()).IsActiveAsync(
            new(issuer, "synthetic-subject"), token, TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("application/json", "{")]
    [InlineData("text/html", "<html>Unavailable</html>")]
    public async Task InvalidUserInfoResponsesAreUnavailableNotSuccessful(string contentType, string content)
    {
        using var client = new HttpClient(new PrivacyHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(content, System.Text.Encoding.UTF8, contentType)
        }));
        await Assert.ThrowsAnyAsync<System.Text.Json.JsonException>(() =>
            new KeycloakActiveAccountVerifier(client, Settings()).IsActiveAsync(
                new(_issuer, "synthetic-subject"), "synthetic-token", TestContext.Current.CancellationToken));
    }

    private static IOptions<PrivacyOptions> Settings() => Options.Create(new PrivacyOptions
    {
        Issuer = _issuer, AllowedIdentityHost = "identity.example.test"
    });
}
