using System.Globalization;
using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class BoardAccountServiceTests
{
    private const string _issuer = AccessManagementServiceTests.Issuer;
    private const string _actorId = "11111111-1111-1111-1111-111111111111";
    private const string _targetId = "22222222-2222-2222-2222-222222222222";
    private const string _groupId = "33333333-3333-3333-3333-333333333333";
    private static readonly DateTimeOffset _now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);
    private readonly FakeBoardAccountStore _store = new();
    private readonly FakeAccessPermissionDirectory _directory = new();
    private readonly FakeAccessAuditStore _audit = new();

    [Fact]
    public async Task LinkOnlyRequiresManageUserReadMfaAndConfirmationNotGrantOrBoardBaseline()
    {
        var (service, actor) = Create("access.permissions.grant", "access.permissions.revoke", "events.read");
        await Link(service, actor);
        Assert.Equal(_targetId, _store.Profile.AccountSubject);
        Assert.Equal(0, _directory.Writes);
        Assert.Empty(_directory.BoardSubjects);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task LinkCannotRestoreActorOrTargetReferencesAfterErasureWaitsOnSharedGate(bool eraseActor)
    {
        var (_, actor) = Create();
        var gate = new PrivacyOperationGate();
        var journal = new MemoryErasureJournal();
        var identities = new FakeIdentityAccountAdmin();
        foreach (var subject in new[] { _actorId, _targetId })
            identities.Accounts[subject] = new IdentityAccount { Id = subject, Enabled = true };
        var privacy = new PrivacyCoordinator(gate, journal, new FakeAccountPrivacyStore(), identities,
            new FakePrivacySnapshotStore(), Options.Create(new PrivacyOptions { Issuer = _issuer }));
        var service = new BoardAccountService(_store, _directory,
            new(_directory, Options.Create(new PrivacyOptions { Issuer = _issuer })), _audit,
            Options.Create(new PermissionDirectoryOptions { Issuer = _issuer }),
            new FixedAuthorizationClock(_now), gate: gate, privacy: privacy);
        using var lease = await gate.EnterAsync(TestContext.Current.CancellationToken);
        var linking = Link(service, actor);
        Assert.False(linking.IsCompleted);
        await journal.SaveAsync(new("erasure", new(_issuer, eraseActor ? _actorId : _targetId), "application_erased"),
            TestContext.Current.CancellationToken);
        lease.Dispose();
        Assert.Equal("account_erasure_in_progress", (await Assert.ThrowsAsync<PrivacyBlockedException>(() => linking)).Code);
        Assert.Equal(0, _store.Writes);
        Assert.Empty(_audit.Entries);
    }

    [Fact]
    public async Task EmailDiscoveryAndExplicitLinkNeverEnrollOrChangeTitleAndLinkSurvivesEmailChange()
    {
        var (service, actor) = Create();
        var status = await service.ReadAsync(actor, _store.Profile.BoardId, TestContext.Current.CancellationToken);
        Assert.Null(status.Account);
        Assert.Single(status.Candidates);
        Assert.Equal(0, _store.Writes);
        await Link(service, actor);
        Assert.Empty(_directory.BoardSubjects);
        Assert.Equal(_targetId, _store.Profile.AccountSubject);
        Assert.Equal("Presidente", _store.Profile.Description);
        _store.Profile.Email = "changed@example.test";
        status = await service.ReadAsync(actor, _store.Profile.BoardId, TestContext.Current.CancellationToken);
        Assert.Equal(_targetId, status.Account!.Subject);
        Assert.Empty(status.Candidates);
        Assert.False(status.IsMember);
        Assert.Equal(["intent", "verified"], _audit.Entries.Select(entry => entry.Outcome));
    }

    [Fact]
    public async Task JoinAndLeavePreservePublicProfileDirectAndOtherInheritedGrants()
    {
        var (service, actor) = Create();
        await Link(service, actor);
        _audit.Entries.Clear();
        _directory.AddUser(new(_issuer, _targetId, "target", true), direct: ["events.manage"], inherited: ["speakers.read"]);
        var joined = await Change(service, actor, false, true);
        Assert.True(joined.IsMember);
        var left = await Change(service, actor, true, false);
        Assert.False(left.IsMember);
        Assert.Equal(_targetId, _store.Profile.AccountSubject);
        Assert.Equal("Presidente", _store.Profile.Description);
        var grants = await _directory.GetAssignmentsAsync(new(_issuer, _targetId), TestContext.Current.CancellationToken);
        Assert.Contains("events.manage", grants.DirectPermissions);
        Assert.Contains("speakers.read", grants.InheritedPermissions);
        Assert.Equal(["board-join", "board-join", "board-leave", "board-leave"], _audit.Entries.Select(entry => entry.Action));
        Assert.All(_audit.Entries, entry => { Assert.Equal(_groupId, entry.GroupId); Assert.Equal("", entry.Permission); });
    }

    [Theory]
    [InlineData("board.manage")]
    [InlineData("access.permissions.grant")]
    [InlineData("events.read")]
    public async Task MissingRequiredPermissionBlocksJoin(string missing)
    {
        var (service, actor) = Create(missing);
        SetLink();
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Change(service, actor, false, true));
        Assert.Equal(0, _directory.Writes);
        Assert.Empty(_audit.Entries);
    }

    [Fact]
    public async Task RevokeDoesNotRequireGrantOrBaselineButStillRequiresRevoke()
    {
        var (service, actor) = Create("access.permissions.grant", "events.read");
        SetLink();
        _directory.BoardSubjects.Add(_targetId);
        Assert.False((await Change(service, actor, true, false)).IsMember);
        (service, actor) = Create("access.permissions.revoke");
        _directory.BoardSubjects.Add(_targetId);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Change(service, actor, true, false));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task FixedGroupAllowsProtectedAndSelfTargets(bool self)
    {
        var (service, actor) = Create();
        var target = self ? _actorId : _targetId;
        SetLink(target);
        _directory.ProtectedSubjects.Add(target);
        Assert.True((await service.ChangeMembershipAsync(actor, _store.Profile.BoardId,
            new(target, false, true), "join", TestContext.Current.CancellationToken)).IsMember);
    }

    [Fact]
    public async Task ExpiredMfaMissingConfirmationAndStaleStateHaveNoWrites()
    {
        var (service, actor) = Create();
        SetLink();
        var expired = Principal(AllPermissions(), _now.AddMinutes(-6));
        Assert.Equal("recent_mfa_required", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Change(service, expired, false, true))).Code);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ChangeMembershipAsync(actor,
            _store.Profile.BoardId, new(_targetId, false, true), null, TestContext.Current.CancellationToken));
        _directory.BoardSubjects.Add(_targetId);
        Assert.Equal("board_membership_changed", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Change(service, actor, false, true))).Code);
        Assert.Equal(0, _directory.Writes);
        Assert.Empty(_audit.Entries);
    }

    [Fact]
    public async Task FailedAuditPreventsProviderWritesAndUncertainProviderResultIsAudited()
    {
        var (service, actor) = Create();
        SetLink();
        _audit.FailAppend = true;
        await Assert.ThrowsAsync<IOException>(() => Change(service, actor, false, true));
        Assert.Equal(0, _directory.Writes);
        _audit.FailAppend = false;
        _directory.FailBoardWrite = true;
        await Assert.ThrowsAsync<HttpRequestException>(() => Change(service, actor, false, true));
        Assert.Equal(["intent", "unverified"], _audit.Entries.Select(entry => entry.Outcome));
        Assert.Equal(_audit.Entries[0].CorrelationId, _audit.Entries[1].CorrelationId);
    }

    [Fact]
    public async Task IgnoredWriteCannotBeReportedAsSuccess()
    {
        var (service, actor) = Create();
        SetLink();
        _directory.IgnoreBoardWrite = true;
        Assert.Equal("board_membership_unverified", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Change(service, actor, false, true))).Code);
        Assert.Equal("unverified", _audit.Entries.Last().Outcome);
    }

    [Fact]
    public async Task MissingAmbiguousDisabledServiceDuplicateAndStaleSelectionsCannotLink()
    {
        var (service, actor) = Create();
        _store.Profile.Email = "missing@example.test";
        Assert.Equal("board_email_match_changed", (await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor))).Code);
        _store.Profile.Email = "board@example.test";
        _directory.AddUser(new(_issuer, _actorId, "other", true), email: "board@example.test");
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor));
        _directory.AddUser(new(_issuer, _targetId, "target", false));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor, false));
        _directory.AddUser(new(_issuer, _targetId, "service", true), serviceAccount: true);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor, false));
        _directory.AddUser(new(_issuer, _targetId, "target", true));
        _store.DuplicateAccount = true;
        Assert.Equal("board_account_already_linked", (await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor, false))).Code);
        _store.DuplicateAccount = false;
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.LinkAsync(actor, _store.Profile.BoardId,
            new(_targetId, "stale@example.test"), "link", TestContext.Current.CancellationToken));
        Assert.Equal(0, _store.Writes);
        Assert.Empty(_directory.BoardSubjects);
    }

    [Fact]
    public async Task ConcurrentStaleJoinsCannotBothMutateMembership()
    {
        var (service, actor) = Create();
        SetLink();
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            try { await Change(service, actor, false, true); return true; }
            catch (PrivacyBlockedException exception) when (exception.Code == "board_membership_changed") { return false; }
        }));
        Assert.Single(results, result => result);
        Assert.Equal(1, _directory.Writes);
    }

    [Fact]
    public async Task LinkedAccountCannotBeSilentlyReplacedAndInvalidIssuerIsRejected()
    {
        var (service, actor) = Create();
        await Link(service, actor);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor));
        Assert.Equal(1, _store.Writes);
        _store.Profile.AccountIssuer = "https://foreign.example/realms/other";
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Change(service, actor, false, true));
        _store.Profile.AccountIssuer = null;
        await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ReadAsync(actor, _store.Profile.BoardId, TestContext.Current.CancellationToken));
        Assert.Equal(0, _directory.Writes);
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public async Task ServiceAccountsAndDisabledJoinTargetsAreRejected(bool serviceAccount, bool enabled)
    {
        var (service, actor) = Create();
        SetLink();
        _directory.AddUser(new(_issuer, _targetId, "target", enabled), serviceAccount: serviceAccount);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Change(service, actor, false, true));
        Assert.Equal(0, _directory.Writes);
        Assert.Empty(_audit.Entries);
    }

    private void SetLink(string subject = _targetId)
    {
        _store.Profile.AccountIssuer = _issuer;
        _store.Profile.AccountSubject = subject;
    }

    private Task Link(BoardAccountService service, ClaimsPrincipal actor, bool matchEmail = true) =>
        service.LinkAsync(actor, _store.Profile.BoardId, new(_targetId, _store.Profile.Email, matchEmail), "link", TestContext.Current.CancellationToken);
    private Task<BoardAccountStatus> Change(BoardAccountService service, ClaimsPrincipal actor, bool expected, bool join) =>
        service.ChangeMembershipAsync(actor, _store.Profile.BoardId, new(_targetId, expected, join), join ? "join" : "leave", TestContext.Current.CancellationToken);
    private static string[] AllPermissions() =>
        [.. BoardGroupPolicy.Permissions, "board.manage", "access.users.read", "access.permissions.grant", "access.permissions.revoke"];
    private static ClaimsPrincipal Principal(IEnumerable<string> permissions, DateTimeOffset authTime) =>
        new(new ClaimsIdentity(new[] { new Claim("iss", _issuer), new Claim("sub", _actorId),
            new Claim("acr", "mfa"), new Claim("auth_time", authTime.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)) }
            .Concat(permissions.Select(permission => new Claim("permissions", permission))), "Bearer"));
    private (BoardAccountService Service, ClaimsPrincipal Actor) Create(params string[] omitted)
    {
        var permissions = AllPermissions().Except(omitted).ToArray();
        _directory.AddUser(new(_issuer, _actorId, "operator", true), inherited: permissions);
        _directory.AddUser(new(_issuer, _targetId, "target", true), email: "board@example.test");
        return (new(_store, _directory, new(_directory, Options.Create(new PrivacyOptions { Issuer = _issuer })),
            _audit, Options.Create(new PermissionDirectoryOptions { Issuer = _issuer, BoardGroupId = _groupId }),
            new FixedAuthorizationClock(_now)), Principal(permissions, _now));
    }
}
