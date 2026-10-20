using System.Net;
using System.Text.Json;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class SpeakerOnboardingDirectoryTests
{
    private const string _issuer = "https://id.example/realms/test";
    private const string _subject = "22222222-2222-2222-2222-222222222222";
    private const string _redirect = "https://www.example.test/account";

    [Fact]
    public async Task CreatePostsOnlyEnabledUnverifiedHumanAndRequiredActionsWithNoPasswordOrGrants()
    {
        var handler = new AccessHttpMessageHandler(async (request, token) =>
        {
            if (IsToken(request)) return Token();
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/admin/realms/test/users", request.RequestUri!.PathAndQuery);
            using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(token));
            var root = json.RootElement;
            Assert.Equal(5, root.EnumerateObject().Count());
            Assert.Equal("speaker@example.test", root.GetProperty("email").GetString());
            Assert.Equal("speaker@example.test", root.GetProperty("username").GetString());
            Assert.True(root.GetProperty("enabled").GetBoolean());
            Assert.False(root.GetProperty("emailVerified").GetBoolean());
            Assert.Equal(["UPDATE_PASSWORD", "VERIFY_EMAIL"],
                root.GetProperty("requiredActions").EnumerateArray().Select(value => value.GetString()));
            var response = new HttpResponseMessage(HttpStatusCode.Created);
            response.Headers.Location = new Uri($"{_issuer.Replace("/realms/", "/admin/realms/", StringComparison.Ordinal)}/users/{_subject}");
            return response;
        });
        var account = await Directory(handler).CreateSpeakerAccountAsync("speaker@example.test", TestContext.Current.CancellationToken);
        Assert.Equal(new AccountReference(_issuer, _subject), account);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://foreign.test/admin/realms/test/users/22222222-2222-2222-2222-222222222222")]
    [InlineData("/admin/realms/test/users/not-a-subject")]
    public async Task MissingOrUnsafeLocationIsNeverAssumedSuccessful(string? location)
    {
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            if (IsToken(request)) return Task.FromResult(Token());
            var response = new HttpResponseMessage(HttpStatusCode.Created);
            if (location is not null) response.Headers.Location = new Uri(location, UriKind.RelativeOrAbsolute);
            return Task.FromResult(response);
        });
        Assert.Equal("speaker_account_create_uncertain", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Directory(handler).CreateSpeakerAccountAsync("speaker@example.test", TestContext.Current.CancellationToken))).Code);
    }

    [Fact]
    public async Task ExecuteActionsUsesOnlyConfiguredAllowlistedClientRedirectAndBoundedLifespan()
    {
        var handler = new AccessHttpMessageHandler(async (request, token) =>
        {
            if (IsToken(request)) return Token();
            Assert.Equal(HttpMethod.Put, request.Method);
            Assert.Equal($"/admin/realms/test/users/{_subject}/execute-actions-email" +
                "?client_id=DotNetLiguriaCore&redirect_uri=https%3A%2F%2Fwww.example.test%2Faccount&lifespan=1800",
                request.RequestUri!.PathAndQuery);
            Assert.Equal("""["UPDATE_PASSWORD","VERIFY_EMAIL"]""", await request.Content!.ReadAsStringAsync(token));
            return new HttpResponseMessage(HttpStatusCode.NoContent);
        });
        await Directory(handler).SendSpeakerInvitationAsync(new(_issuer, _subject),
            ["UPDATE_PASSWORD", "VERIFY_EMAIL"], TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData("client")]
    [InlineData("redirect")]
    [InlineData("allowlist")]
    [InlineData("lifespan")]
    public async Task UnsafeInvitationConfigurationFailsWithoutNetwork(string invalid)
    {
        var calls = 0;
        var handler = new AccessHttpMessageHandler((_, _) => { calls++; throw new InvalidOperationException(); });
        var options = Options();
        if (invalid == "client") options.InvitationClientId = "untrusted";
        if (invalid == "redirect") options.InvitationRedirectUri = "http://www.example.test/account";
        if (invalid == "allowlist") options.AllowedInvitationRedirectUris = [];
        if (invalid == "lifespan") options.InvitationLifespanSeconds = 86401;
        var directory = new KeycloakPermissionDirectory(new HttpClient(handler), Microsoft.Extensions.Options.Options.Create(options));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            directory.CreateSpeakerAccountAsync("speaker@example.test", TestContext.Current.CancellationToken));
        Assert.Equal(0, calls);
    }

    [Theory]
    [InlineData(false, """["UPDATE_PASSWORD"]""", "UPDATE_PASSWORD,VERIFY_EMAIL")]
    [InlineData(true, """["VERIFY_EMAIL"]""", "")]
    [InlineData(false, """[]""", "VERIFY_EMAIL")]
    public async Task ResendActionsRespectCompletedPasswordAndEmailVerification(bool verified, string actions, string expected)
    {
        var handler = new AccessHttpMessageHandler((request, _) => Task.FromResult(IsToken(request) ? Token() :
            AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                $$"""{"id":"{{_subject}}","enabled":true,"email":"speaker@example.test","emailVerified":{{verified.ToString().ToLowerInvariant()}},"requiredActions":{{actions}}}""")));
        var account = await Directory(handler).ReadInvitationAccountAsync(new(_issuer, _subject), TestContext.Current.CancellationToken);
        Assert.Equal(expected, string.Join(',', account.RequiredActions));
    }

    private static bool IsToken(HttpRequestMessage request) => request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal);
    private static HttpResponseMessage Token() =>
        AccessHttpMessageHandler.Json(HttpStatusCode.OK, """{"access_token":"test-service-token","expires_in":60}""");
    private static PermissionDirectoryOptions Options() => new()
    {
        Issuer = _issuer, AllowedIdentityHost = "id.example", ServiceClientId = "permission-service",
        ServiceClientSecret = "synthetic-test-secret", ApplicationClientId = "DotNetLiguriaCore",
        InvitationClientId = "DotNetLiguriaCore", InvitationRedirectUri = _redirect,
        AllowedInvitationRedirectUris = [_redirect], InvitationLifespanSeconds = 1800
    };
    private static KeycloakPermissionDirectory Directory(AccessHttpMessageHandler handler) =>
        new(new HttpClient(handler), Microsoft.Extensions.Options.Options.Create(Options()));
}
