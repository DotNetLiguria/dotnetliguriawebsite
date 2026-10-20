using System.Globalization;
using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class AccessManagementServiceTests
{
    public const string Issuer = "https://id.example/realms/test";
    private const string _actorSubject = "11111111-1111-1111-1111-111111111111";
    private const string _targetSubject = "22222222-2222-2222-2222-222222222222";
    private static readonly DateTimeOffset _now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task EmptySearchListsAllUsersWithBoundedPagination()
    {
        var (service, _, _, _) = Create(["access.users.read"]);
        var first = await service.SearchUsersAsync("", 0, 1, CancellationToken.None);
        var second = await service.SearchUsersAsync("  ", 1, 1, CancellationToken.None);
        Assert.Single(first.Users);
        Assert.True(first.HasMore);
        Assert.Single(second.Users);
        Assert.False(second.HasMore);
        Assert.NotEqual(first.Users[0].Subject, second.Users[0].Subject);
    }

    [Theory]
    [InlineData("\n", 0, 25)]
    [InlineData("", -1, 25)]
    [InlineData("", 0, 51)]
    public async Task UnfilteredListingStillValidatesPaginationAndControlCharacters(string search, int first, int max)
    {
        var (service, _, _, _) = Create(["access.users.read"]);
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.SearchUsersAsync(search, first, max, CancellationToken.None));
        Assert.Equal("invalid_access_search", error.Code);
    }

    [Fact]
    public async Task BoardFilterUsesGroupBeforeSearchAndPaginationWithoutProfileOrEmail()
    {
        var (service, directory, _, _) = Create(["access.users.read"]);
        directory.AddUser(new(Issuer, "board-z", "Zeta", true), email: "zeta@example.test");
        directory.AddUser(new(Issuer, "board-a", "Ada", true), email: "ada@example.test");
        directory.AddUser(new(Issuer, "outsider", "Aaron", true), email: "outside@example.test");
        directory.BoardSubjects.UnionWith(["board-z", "board-a"]);

        var first = await service.SearchUsersAsync("", 0, 1, CancellationToken.None, true);
        var second = await service.SearchUsersAsync("", 1, 1, CancellationToken.None, true);
        Assert.Equal("Ada", Assert.Single(first.Users).Username);
        Assert.True(first.HasMore);
        Assert.Equal("Zeta", Assert.Single(second.Users).Username);
        Assert.False(second.HasMore);
        var search = await service.SearchUsersAsync("zeta", 0, 25, CancellationToken.None, true);
        Assert.Equal("Zeta", Assert.Single(search.Users).Username);
        Assert.False(search.HasMore);
        directory.BoardSubjects.Clear();
        var empty = await service.SearchUsersAsync("", 0, 25, CancellationToken.None, true);
        Assert.Empty(empty.Users);
        Assert.False(empty.HasMore);
    }

    [Fact]
    public void DelegationAllowlistContainsOnlyKnownTaskPermissionsAndExcludesReservedAreas()
    {
        Assert.All(PermissionDelegationPolicy.DelegableIds,
            permission => Assert.True(PermissionCatalog.IsKnown(permission)));
        Assert.All(PermissionCatalog.Ids.Where(permission =>
                permission.StartsWith("access.", StringComparison.Ordinal) ||
                permission.StartsWith("maintenance.", StringComparison.Ordinal) ||
                permission.StartsWith("privacy.", StringComparison.Ordinal) ||
                permission == "backups.restore"),
            permission => Assert.False(PermissionDelegationPolicy.IsDelegable(permission)));
        Assert.True(PermissionDelegationPolicy.IsDelegable("backups.read"));
        Assert.True(PermissionDelegationPolicy.IsDelegable("backups.create"));
    }

    [Fact]
    public async Task GrantRequiresCurrentActorPermissionMfaAndExpectedDirectSnapshotAndIsAudited()
    {
        var permissions = new[]
        {
            "access.users.read", "access.permissions.grant", "events.read", "events.manage"
        };
        var (service, directory, audit, actor) = Create(permissions);

        var result = await service.ChangePermissionAsync(actor, _targetSubject, "events.manage", grant: true,
            Array.Empty<string>(), "grant", CancellationToken.None);

        Assert.True(result.Changed);
        Assert.Contains("events.manage", result.DirectPermissions);
        Assert.Contains("events.manage", result.EffectivePermissions);
        Assert.Equal(["intent", "verified"], audit.Entries.Select(entry => entry.Outcome));
        Assert.Equal(1, directory.Writes);
        Assert.Equal(audit.Entries[0].CorrelationId, audit.Entries[1].CorrelationId);
    }

    [Fact]
    public async Task SelfServiceAccountAndProtectedTargetsCannotBeEdited()
    {
        var permissions = new[] { "access.users.read", "access.permissions.grant", "events.read" };
        var (service, directory, audit, actor) = Create(permissions);

        var self = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _actorSubject, "events.read", true, [], "grant", CancellationToken.None));
        directory.AddUser(new(Issuer, _targetSubject, "service", true), serviceAccount: true);
        var serviceAccount = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", true, [], "grant", CancellationToken.None));
        directory.AddUser(new(Issuer, _targetSubject, "operator", true));
        directory.ProtectedSubjects.Add(_targetSubject);
        var protectedTarget = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", true, [], "grant", CancellationToken.None));

        Assert.Equal(StatusCodes.Status403Forbidden, self.StatusCode);
        Assert.Equal(StatusCodes.Status403Forbidden, serviceAccount.StatusCode);
        Assert.Equal(StatusCodes.Status403Forbidden, protectedTarget.StatusCode);
        Assert.Equal(0, directory.Writes);
        Assert.Empty(audit.Entries);
    }

    [Fact]
    public async Task UnknownNonDelegableStaleAndInheritedAssignmentsAreRejectedWithoutWrites()
    {
        var permissions = new[]
        {
            "access.users.read", "access.permissions.grant", "access.permissions.revoke",
            "events.read", "backups.restore"
        };
        var (service, directory, audit, actor) = Create(permissions);
        var notDelegable = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "backups.restore", true, [], "grant", CancellationToken.None));
        directory.AddUser(new(Issuer, _targetSubject, "editor", true), direct: ["events.read"]);
        var stale = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", true, [], "grant", CancellationToken.None));
        directory.AddUser(new(Issuer, _targetSubject, "editor", true), inherited: ["events.read"]);
        var inherited = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", false, [], "revoke", CancellationToken.None));

        Assert.Equal(StatusCodes.Status403Forbidden, notDelegable.StatusCode);
        Assert.Equal(StatusCodes.Status409Conflict, stale.StatusCode);
        Assert.Equal("permission_remains_inherited", inherited.Code);
        Assert.Equal(0, directory.Writes);
        Assert.Empty(audit.Entries);
    }

    [Fact]
    public async Task RevokingDirectGrantAlsoInheritedKeepsTheEffectiveGrantVisible()
    {
        var (service, directory, audit, actor) = Create(
            ["access.users.read", "access.permissions.revoke", "events.read"]);
        directory.AddUser(new(Issuer, _targetSubject, "editor", true),
            direct: ["events.read"], inherited: ["events.read"]);

        var result = await service.ChangePermissionAsync(actor, _targetSubject, "events.read", grant: false,
            ["events.read"], "revoke", CancellationToken.None);

        Assert.True(result.Changed);
        Assert.DoesNotContain("events.read", result.DirectPermissions);
        Assert.Contains("events.read", result.InheritedPermissions);
        Assert.Contains("events.read", result.EffectivePermissions);
        Assert.Equal(["intent", "verified"], audit.Entries.Select(entry => entry.Outcome));
        Assert.Equal(1, directory.Writes);
    }

    [Fact]
    public async Task ActorMustCurrentlyHoldThePermissionAndCorrectChangePolicy()
    {
        var (service, directory, audit, actor) = Create(["access.users.read", "access.permissions.grant"]);

        var denied = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.manage", true, [], "grant", CancellationToken.None));
        Assert.Equal(StatusCodes.Status403Forbidden, denied.StatusCode);

        var withoutGrant = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", true, [], "grant", CancellationToken.None));
        Assert.Equal(StatusCodes.Status403Forbidden, withoutGrant.StatusCode);
        Assert.Equal(0, directory.Writes);
        Assert.Empty(audit.Entries);
    }

    [Fact]
    public async Task AuditHistoryResolvesActorAndTargetUsernamesWithoutPersistingThem()
    {
        var (service, _, audit, actor) = Create(["access.users.read", "access.permissions.grant", "events.read"]);
        await service.ChangePermissionAsync(actor, _targetSubject, "events.read", grant: true,
            Array.Empty<string>(), "grant", CancellationToken.None);
        const string deletedSubject = "44444444-4444-4444-4444-444444444444";
        audit.Entries.Add(new("gone", _now.AddMinutes(-1), "revoke", "events.read",
            Issuer, deletedSubject, Issuer, _targetSubject, "verified", "old"));

        var page = await service.ReadAuditAsync(0, 25, CancellationToken.None);

        var verified = page.Entries.First(entry => entry.Outcome == "verified" && entry.ActorSubject == _actorSubject);
        Assert.Equal("operator", verified.ActorUsername);
        Assert.Equal("editor", verified.TargetUsername);
        var orphan = page.Entries.Single(entry => entry.ActorSubject == deletedSubject);
        Assert.Null(orphan.ActorUsername);
        Assert.Equal("editor", orphan.TargetUsername);
        Assert.Equal(3, page.Entries.Count);
    }

    [Fact]
    public async Task MutationRequiresExplicitConfirmationAndRecentMfa()
    {
        var (service, _, audit, actor) = Create(["access.users.read", "access.permissions.grant", "events.read"]);

        var confirmation = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(actor, _targetSubject, "events.read", true, [], "wrong", CancellationToken.None));
        var staleMfaActor = CreatePrincipal(["access.users.read", "access.permissions.grant", "events.read"],
            _actorSubject, _now.AddMinutes(-6));
        var mfa = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ChangePermissionAsync(staleMfaActor, _targetSubject, "events.read", true, [], "grant", CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, confirmation.StatusCode);
        Assert.Equal("recent_mfa_required", mfa.Code);
        Assert.Empty(audit.Entries);
    }

    private static (AccessManagementService Service, FakeAccessPermissionDirectory Directory,
        FakeAccessAuditStore Audit, ClaimsPrincipal Actor) Create(IEnumerable<string> permissions)
    {
        var permissionIds = permissions.ToArray();
        var actor = CreatePrincipal(permissionIds, _actorSubject, _now);
        var directory = new FakeAccessPermissionDirectory();
        directory.AddUser(new(Issuer, _actorSubject, "operator", true), inherited: permissionIds);
        directory.AddUser(new(Issuer, _targetSubject, "editor", true));
        var audit = new FakeAccessAuditStore();
        var evaluator = new PermissionEvaluator(directory,
            Options.Create(new PrivacyOptions { Issuer = Issuer }));
        var service = new AccessManagementService(directory, evaluator, audit,
            Options.Create(new PermissionDirectoryOptions
            {
                Issuer = Issuer,
                ProtectedGroupIds = ["33333333-3333-3333-3333-333333333333"]
            }), new FixedAuthorizationClock(_now));
        return (service, directory, audit, actor);
    }

    private static ClaimsPrincipal CreatePrincipal(IEnumerable<string> permissions, string subject, DateTimeOffset authTime)
    {
        var claims = new List<Claim>
        {
            new("iss", Issuer), new("sub", subject),
            new("acr", "mfa"), new("auth_time", authTime.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture))
        };
        claims.AddRange(permissions.Select(permission => new Claim("permissions", permission)));
        return new(new ClaimsIdentity(claims, "Bearer"));
    }
}
