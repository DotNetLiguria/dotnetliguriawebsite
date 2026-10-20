using System.Net;
using System.Text.Json;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class BoardGroupDirectoryTests
{
    private const string _issuer = "https://id.example/realms/test";
    private const string _client = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string _group = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private const string _subject = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    [Fact]
    public async Task MissingConfigurationFailsBeforeAnyProviderRequest()
    {
        var handler = new AccessHttpMessageHandler((_, _) => throw new InvalidOperationException("Unexpected network"));
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Directory(handler, "").GetBoardMembersAsync(TestContext.Current.CancellationToken));
        Assert.Equal("board_group_not_configured", error.Code);
    }

    [Theory]
    [InlineData("realm")]
    [InlineData("foreign")]
    [InlineData("composite")]
    [InlineData("extra")]
    [InlineData("missing")]
    [InlineData("nested")]
    [InlineData("wrong-id")]
    public async Task UnsafeGroupNeverReachesMembershipWrite(string drift)
    {
        var writes = 0;
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            if (request.Method == HttpMethod.Put) writes++;
            return Task.FromResult(Reply(request, drift));
        });
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Directory(handler).ChangeBoardMembershipAsync(new(_issuer, _subject), true, TestContext.Current.CancellationToken));
        Assert.Equal(0, writes);
    }

    [Fact]
    public async Task MemberListingReadsAllProviderPagesAndRetainsMembersWithoutProfiles()
    {
        var pages = new List<int>();
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            if (!request.RequestUri!.AbsolutePath.EndsWith("/members", StringComparison.Ordinal))
                return Task.FromResult(Reply(request));
            var first = request.RequestUri.Query.Contains("first=100", StringComparison.Ordinal) ? 100 : 0;
            pages.Add(first);
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                JsonSerializer.Serialize(Enumerable.Range(first, first == 0 ? 100 : 1).Select(index => new
                {
                    id = $"00000000-0000-0000-0001-{index:D12}", username = $"member-{index:D3}", enabled = true
                }))));
        });
        var members = await Directory(handler).GetBoardMembersAsync(TestContext.Current.CancellationToken);
        Assert.Equal(101, members.Count);
        Assert.Equal([0, 100], pages);
        Assert.Contains(members, member => member.Username == "member-100");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MembershipMutationTouchesOnlyConfiguredGroupAndCanBeReadBack(bool join)
    {
        var member = !join;
        var writes = new List<string>();
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            var path = request.RequestUri!.AbsolutePath;
            if (request.Method == HttpMethod.Put || request.Method == HttpMethod.Delete)
            {
                writes.Add($"{request.Method} {path}");
                member = request.Method == HttpMethod.Put;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NoContent));
            }
            if (path.EndsWith($"/users/{_subject}/groups", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    member ? $$"""[{"id":"{{_group}}"}]""" : "[]"));
            return Task.FromResult(Reply(request));
        });
        var directory = Directory(handler);
        await directory.ChangeBoardMembershipAsync(new(_issuer, _subject), join, TestContext.Current.CancellationToken);
        Assert.Equal(join, await directory.IsBoardMemberAsync(new(_issuer, _subject), TestContext.Current.CancellationToken));
        Assert.Equal($"{(join ? "PUT" : "DELETE")} /admin/realms/test/users/{_subject}/groups/{_group}", Assert.Single(writes));
    }

    private static KeycloakPermissionDirectory Directory(HttpMessageHandler handler, string group = _group) =>
        new(new HttpClient(handler), Options.Create(new PermissionDirectoryOptions
        {
            Issuer = _issuer, AllowedIdentityHost = "id.example", BoardGroupId = group,
            ServiceClientId = "access-service", ServiceClientSecret = "unit-test-secret"
        }));

    private static HttpResponseMessage Reply(HttpRequestMessage request, string drift = "")
    {
        var path = request.RequestUri!.PathAndQuery;
        if (path.EndsWith("/token", StringComparison.Ordinal))
            return AccessHttpMessageHandler.Json(HttpStatusCode.OK, """{"access_token":"fake-token","expires_in":60}""");
        if (path.Contains("/clients?clientId=", StringComparison.Ordinal))
            return AccessHttpMessageHandler.Json(HttpStatusCode.OK, $$"""[{"id":"{{_client}}","clientId":"DotNetLiguriaCore"}]""");
        if (path.EndsWith($"/groups/{_group}", StringComparison.Ordinal))
            return AccessHttpMessageHandler.Json(HttpStatusCode.OK, JsonSerializer.Serialize(new
            {
                id = drift == "wrong-id" ? _subject : _group, name = "Board members",
                path = drift == "nested" ? "/parent/Board members" : "/Board members"
            }));
        var names = BoardGroupPolicy.Permissions.ToList();
        if (drift == "extra") names.Add("events.manage");
        if (drift == "missing") names.RemoveAt(0);
        var roles = names.Select((name, index) => new
        {
            id = $"00000000-0000-0000-0002-{index:D12}", name,
            containerId = _client, clientRole = true, composite = drift == "composite"
        }).ToArray();
        if (path.EndsWith("/role-mappings", StringComparison.Ordinal))
            return AccessHttpMessageHandler.Json(HttpStatusCode.OK, JsonSerializer.Serialize(new
            {
                realmMappings = drift == "realm" ? new[] { new { id = _subject, name = "admin" } } : [],
                clientMappings = new Dictionary<string, object>
                {
                    ["DotNetLiguriaCore"] = new { id = drift == "foreign" ? _subject : _client, mappings = roles }
                }
            }));
        if (path.EndsWith("/composite", StringComparison.Ordinal))
            return AccessHttpMessageHandler.Json(HttpStatusCode.OK, JsonSerializer.Serialize(roles));
        throw new InvalidOperationException($"Unexpected fake endpoint: {path}");
    }
}
