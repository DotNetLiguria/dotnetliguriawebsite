using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class KeycloakProfileClientTests
{
    private const string _issuer = "https://identity.example.test/realms/synthetic";
    private readonly AccountReference _account = new(_issuer, "immutable-subject");
    private readonly MemoryErasureJournal _journal = new();

    [Fact]
    public async Task UpdateUsesCallerTokenPreservesAttributesAndReturnsOnlyFreshProfile()
    {
        var requests = 0;
        using var http = new HttpClient(new PrivacyHttpHandler(request =>
        {
            Assert.Equal(_issuer + "/account/", request.RequestUri!.AbsoluteUri);
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            Assert.Equal("synthetic-caller-token", request.Headers.Authorization.Parameter);
            requests++;
            if (request.Method == HttpMethod.Post)
            {
                var body = JsonSerializer.SerializeToElement(request.Content!.ReadFromJsonAsync<JsonElement>().GetAwaiter().GetResult());
                Assert.Equal(new[] { "attributes", "email", "firstName", "lastName", "username" },
                    body.EnumerateObject().Select(property => property.Name).Order().ToArray());
                Assert.Equal("New name", body.GetProperty("firstName").GetString());
                Assert.Equal("New surname", body.GetProperty("lastName").GetString());
                Assert.Equal("old@example.test", body.GetProperty("email").GetString());
                Assert.Equal("unchanged-username", body.GetProperty("username").GetString());
                Assert.Equal("it", body.GetProperty("attributes").GetProperty("locale")[0].GetString());
                Assert.Equal("server-only-evidence", body.GetProperty("attributes").GetProperty("dnl_notifications_events")[0].GetString());
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }
            return ProfileResponse(requests == 1 ? "Old name" : "New name",
                "old@example.test",
                verified: true, lastName: requests == 1 ? "Old surname" : "New surname");
        }));

        var saved = await Client(http).UpdateAsync(_account, "synthetic-caller-token",
            new(" New name ", "New surname"), TestContext.Current.CancellationToken);

        Assert.Equal(new PersonalIdentity("New name", "New surname", "old@example.test", true), saved);
        Assert.Equal(3, requests);
        var result = JsonSerializer.Serialize(saved);
        Assert.DoesNotContain("server-only-evidence", result);
        Assert.DoesNotContain("immutable-subject", result);
        Assert.Empty(_journal.Operations);
    }

    [Fact]
    public async Task ReadingProfileDoesNotRequireAdministrativeCredentialsOrDatabase()
    {
        using var http = new HttpClient(new PrivacyHttpHandler(request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            return ProfileResponse();
        }));
        var identity = await Client(http).GetAsync(_account, "synthetic-caller-token", TestContext.Current.CancellationToken);
        Assert.Equal("old@example.test", identity.Email);
        Assert.True(identity.EmailVerified);
    }

    [Theory]
    [InlineData(400, "profile_update_rejected", 400)]
    [InlineData(422, "profile_update_rejected", 400)]
    [InlineData(409, "profile_update_conflict", 409)]
    [InlineData(403, "profile_edit_forbidden", 403)]
    [InlineData(401, "profile_session_expired", 401)]
    [InlineData(302, "profile_dependency_unavailable", 503)]
    [InlineData(503, "profile_dependency_unavailable", 503)]
    public async Task UpstreamErrorsAreExplicitAndNeverExposeResponseBodies(int status, string code, int expectedStatus)
    {
        using var http = new HttpClient(new PrivacyHttpHandler(request => request.Method == HttpMethod.Get
            ? ProfileResponse() : new HttpResponseMessage((HttpStatusCode)status)
            {
                Content = new StringContent("private-upstream-validation-and-email")
            }));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new("New name", "Old surname"), TestContext.Current.CancellationToken));
        Assert.Equal(code, error.Code);
        Assert.Equal(expectedStatus, error.StatusCode);
        Assert.DoesNotContain("private-upstream", error.ToString());
    }

    [Fact]
    public async Task ErasureBlocksUpdatesBeforeContactingKeycloak()
    {
        _journal.Operations["pending"] = new("pending", _account, "preflight_blocked");
        using var http = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("Must not call identity")));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new("New name", "Old surname"), TestContext.Current.CancellationToken));
        Assert.Equal("account_erasure_in_progress", error.Code);
    }

    [Theory]
    [InlineData("Name\nInjected")]
    [InlineData("Name\tInjected")]
    public async Task InvalidInputIsRejectedBeforeContactingKeycloak(string firstName)
    {
        using var http = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("Must not call identity")));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new(firstName, "Surname"), TestContext.Current.CancellationToken));
        Assert.Equal("profile_update_invalid", error.Code);
        Assert.Equal(400, error.StatusCode);
    }

    [Theory]
    [InlineData("id", "\"other-account\"")]
    [InlineData("emailVerified", "true")]
    [InlineData("attributes", "{\"dnl_notifications_events\":[\"forged\"]}")]
    [InlineData("realmRoles", "[\"admin\"]")]
    [InlineData("username", "\"other-user\"")]
    [InlineData("email", "\"new@example.test\"")]
    public void UpdateContractRejectsFieldsOutsideTheEditableAllowlist(string field, string value)
    {
        var json = "{\"firstName\":\"Name\",\"lastName\":\"Surname\",\"" + field + "\":" + value + "}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<PersonalIdentityUpdate>(json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Fact]
    public async Task UnconfirmedPersistenceNeverReportsSuccess()
    {
        using var http = new HttpClient(new PrivacyHttpHandler(request => request.Method == HttpMethod.Post
            ? new HttpResponseMessage(HttpStatusCode.NoContent) : ProfileResponse()));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new("Changed name", "Old surname"), TestContext.Current.CancellationToken));
        Assert.Equal("profile_update_not_verified", error.Code);
    }

    [Fact]
    public async Task UnexpectedEmailChangeCannotReportSuccess()
    {
        var reads = 0;
        using var http = new HttpClient(new PrivacyHttpHandler(request => request.Method == HttpMethod.Post
            ? new HttpResponseMessage(HttpStatusCode.NoContent)
            : ProfileResponse(email: ++reads == 1 ? "old@example.test" : "new@example.test")));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new("Old name", "Old surname"), TestContext.Current.CancellationToken));
        Assert.Equal("profile_update_not_verified", error.Code);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task UnchangedEmailRetainsKeycloakVerificationState(bool verified)
    {
        using var http = new HttpClient(new PrivacyHttpHandler(request => request.Method == HttpMethod.Post
            ? new HttpResponseMessage(HttpStatusCode.NoContent) : ProfileResponse(verified: verified)));
        var saved = await Client(http).UpdateAsync(_account, "synthetic-caller-token",
            new("Old name", "Old surname"), TestContext.Current.CancellationToken);
        Assert.Equal(verified, saved.EmailVerified);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task UnexpectedVerificationChangeCannotReportSuccess(bool initiallyVerified)
    {
        var reads = 0;
        using var http = new HttpClient(new PrivacyHttpHandler(request => request.Method == HttpMethod.Post
            ? new HttpResponseMessage(HttpStatusCode.NoContent)
            : ProfileResponse(verified: ++reads == 1 ? initiallyVerified : !initiallyVerified)));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Client(http).UpdateAsync(_account,
            "synthetic-caller-token", new("Old name", "Old surname"), TestContext.Current.CancellationToken));
        Assert.Equal("profile_update_not_verified", error.Code);
    }

    [Fact]
    public async Task AnotherSubjectsResponseIsRejected()
    {
        using var http = new HttpClient(new PrivacyHttpHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { id = "other-subject" }) }));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Client(http).GetAsync(_account, "synthetic-caller-token", TestContext.Current.CancellationToken));
        Assert.Equal("profile_invalid_response", error.Code);
    }

    [Fact]
    public async Task MissingTokenAndForeignIssuerNeverSendRequests()
    {
        using var http = new HttpClient(new PrivacyHttpHandler(_ => throw new InvalidOperationException("Must not call identity")));
        var client = Client(http);
        var missing = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            client.GetAsync(_account, null, TestContext.Current.CancellationToken));
        Assert.Equal(401, missing.StatusCode);
        var foreign = await Assert.ThrowsAsync<PrivacyBlockedException>(() => client.GetAsync(
            new("https://unapproved.example/realms/other", _account.Subject), "synthetic-caller-token", TestContext.Current.CancellationToken));
        Assert.Equal(403, foreign.StatusCode);
    }

    private KeycloakProfileClient Client(HttpClient http) => new(http,
        Options.Create(new PrivacyOptions { Issuer = _issuer, AllowedIdentityHost = "identity.example.test" }),
        new PrivacyOperationGate(), _journal);

    private static HttpResponseMessage ProfileResponse(string firstName = "Old name",
        string email = "old@example.test", bool verified = true, string lastName = "Old surname") =>
        new(HttpStatusCode.OK)
        {
            Content = JsonContent.Create(new
            {
                id = "immutable-subject", username = "unchanged-username", firstName, lastName, email,
                emailVerified = verified,
                attributes = new Dictionary<string, string[]> { ["locale"] = ["it"], ["dnl_notifications_events"] = ["server-only-evidence"] }
            })
        };
}
