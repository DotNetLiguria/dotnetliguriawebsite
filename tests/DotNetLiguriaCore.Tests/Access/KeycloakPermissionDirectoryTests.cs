using System.Net;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class KeycloakPermissionDirectoryTests
{
    private const string _issuer = "https://id.example/realms/test";
    private const string _clientId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string _roleId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private const string _subject = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    [Fact]
    public async Task UnfilteredListingOmitsSearchAndKeepsProviderPagination()
    {
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            var path = request.RequestUri!.PathAndQuery;
            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """{"access_token":"service-token","expires_in":60}"""));
            Assert.Equal("/admin/realms/test/users?first=25&max=26&briefRepresentation=false", path);
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                $$"""[{"id":"{{_subject}}","username":"ordinary-member","enabled":true}]"""));
        });
        var users = await CreateDirectory(handler).SearchUsersAsync("", 25, 26, CancellationToken.None);
        Assert.Equal("ordinary-member", Assert.Single(users).Username);
    }

    [Fact]
    public async Task BoardEmailLookupUsesExactEncodedEmailAndExcludesUnrelatedOrServiceAccounts()
    {
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            var path = request.RequestUri!.PathAndQuery;
            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """{"access_token":"service-token","expires_in":60}"""));
            Assert.Equal("/admin/realms/test/users?email=board%2Bmember%40example.test&exact=true&first=0&max=51&briefRepresentation=false", path);
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                $$"""
                [
                  {"id":"{{_subject}}","username":"member","email":"BOARD+MEMBER@example.test","enabled":true},
                  {"id":"dddddddd-dddd-dddd-dddd-dddddddddddd","username":"unrelated","email":"other@example.test","enabled":true},
                  {"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","username":"service","email":"board+member@example.test","enabled":true,"serviceAccountClientId":"service"}
                ]
                """));
        });
        var users = await CreateDirectory(handler).FindUsersByEmailAsync("board+member@example.test", CancellationToken.None);
        Assert.Equal("member", Assert.Single(users).Username);
    }

    [Theory]
    [InlineData("[]", null)]
    [InlineData("{}", "permission_directory_invalid_response")]
    public async Task BoardEmailLookupDistinguishesMissingUsersFromInvalidResponses(string response, string? expectedError)
    {
        var handler = new AccessHttpMessageHandler((request, _) => Task.FromResult(
            AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
                    ? """{"access_token":"service-token","expires_in":60}""" : response)));
        var directory = CreateDirectory(handler);
        if (expectedError is null)
            Assert.Empty(await directory.FindUsersByEmailAsync("board@example.test", CancellationToken.None));
        else
            Assert.Equal(expectedError, (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
                directory.FindUsersByEmailAsync("board@example.test", CancellationToken.None))).Code);
    }

    [Fact]
    public async Task EffectiveRolesAreReadOnlyFromTheFixedApplicationClientAndUnknownRolesAreIgnored()
    {
        var requests = new List<string>();
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            requests.Add($"{request.Method} {request.RequestUri}");
            var path = request.RequestUri!.PathAndQuery;
            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """{"access_token":"service-token","expires_in":60}"""));
            if (path.Contains("/clients?clientId=DotNetLiguriaCore", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    $$"""[{"id":"{{_clientId}}","clientId":"DotNetLiguriaCore"}]"""));
            if (path.EndsWith("/composite", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    $$"""[{"id":"{{_roleId}}","name":"events.read","clientRole":true,"containerId":"{{_clientId}}","composite":false},{"id":"dddddddd-dddd-dddd-dddd-dddddddddddd","name":"unrecognized","clientRole":true,"containerId":"{{_clientId}}","composite":false}]"""));
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.NotFound, "{}"));
        });
        var directory = CreateDirectory(handler);

        var permissions = await directory.GetEffectiveAsync(new(_issuer, _subject), CancellationToken.None);

        Assert.Equal(["events.read"], permissions);
        Assert.Contains(requests, request => request.Contains("/clients?clientId=DotNetLiguriaCore", StringComparison.Ordinal));
        Assert.DoesNotContain(requests, request => request.Contains("service-token", StringComparison.Ordinal));
        Assert.Single(requests, request =>
            request.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal));
    }

    [Fact]
    public async Task DirectMappingsRemainSeparateFromInheritedEffectiveMappings()
    {
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            var path = request.RequestUri!.PathAndQuery;
            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """{"access_token":"service-token","expires_in":60}"""));
            if (path.Contains("/clients?clientId=DotNetLiguriaCore", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    $$"""[{"id":"{{_clientId}}","clientId":"DotNetLiguriaCore"}]"""));
            if (path.EndsWith($"/role-mappings/clients/{_clientId}", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK, Role("events.manage")));
            if (path.EndsWith($"/role-mappings/clients/{_clientId}/composite", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    $"[{RoleObject("events.read")},{RoleObject("events.manage")}]"));
            if (path.Contains("/groups?first=0&max=100&briefRepresentation=false", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """[{"id":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","clientRoles":{"DotNetLiguriaCore":["events.read","events.manage"]}}]"""));
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.NotFound, "{}"));
        });
        var directory = CreateDirectory(handler);

        var snapshot = await directory.GetAssignmentsAsync(new(_issuer, _subject), CancellationToken.None);

        Assert.Equal(["events.manage"], snapshot.DirectPermissions);
        Assert.Equal(["events.manage", "events.read"], snapshot.InheritedPermissions.Order(StringComparer.Ordinal));
        Assert.Equal(["events.manage", "events.read"], snapshot.EffectivePermissions.Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task ProviderFailuresBecomeExplicitUnavailableErrorsInsteadOfEmptyGrants()
    {
        var handler = new AccessHttpMessageHandler((request, _) =>
        {
            var path = request.RequestUri!.PathAndQuery;
            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    """{"access_token":"service-token","expires_in":60}"""));
            if (path.Contains("/clients?clientId=DotNetLiguriaCore", StringComparison.Ordinal))
                return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK,
                    $$"""[{"id":"{{_clientId}}","clientId":"DotNetLiguriaCore"}]"""));
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.Forbidden, "{}"));
        });
        var directory = CreateDirectory(handler);

        var exception = await Assert.ThrowsAsync<PrivacyBlockedException>(
            () => directory.GetEffectiveAsync(new(_issuer, _subject), CancellationToken.None));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, exception.StatusCode);
        Assert.Equal("permission_directory_unavailable", exception.Code);
    }

    [Fact]
    public async Task ProtectedAndUnknownPermissionMappingsCannotBeWritten()
    {
        var calls = 0;
        var handler = new AccessHttpMessageHandler((_, _) =>
        {
            calls++;
            return Task.FromResult(AccessHttpMessageHandler.Json(HttpStatusCode.OK, "{}"));
        });
        var directory = CreateDirectory(handler);

        var exception = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            directory.ChangeDirectPermissionAsync(new(_issuer, _subject), "access.permissions.grant",
                grant: true, CancellationToken.None));

        Assert.Equal(StatusCodes.Status403Forbidden, exception.StatusCode);
        Assert.Equal(0, calls);
    }

    private static KeycloakPermissionDirectory CreateDirectory(HttpMessageHandler handler) =>
        new(new HttpClient(handler), Options.Create(new PermissionDirectoryOptions
        {
            Issuer = _issuer,
            AllowedIdentityHost = "id.example",
            ServiceClientId = "access-service",
            ServiceClientSecret = "unit-test-secret",
            ProtectedGroupIds = ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"]
        }));

    private static string Role(string name) => $"[{RoleObject(name)}]";

    private static string RoleObject(string name) =>
        $$"""{"id":"{{_roleId}}","name":"{{name}}","clientRole":true,"containerId":"{{_clientId}}","composite":false}""";
}
