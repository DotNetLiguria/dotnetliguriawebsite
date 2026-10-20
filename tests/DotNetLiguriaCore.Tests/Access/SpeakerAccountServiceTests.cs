using System.Globalization;
using System.Security.Claims;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class SpeakerAccountServiceTests
{
    private const string _issuer = AccessManagementServiceTests.Issuer;
    private const string _actorId = "11111111-1111-1111-1111-111111111111";
    private static readonly DateTimeOffset _now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);
    private readonly FakeSpeakerAccountStore _store = new();
    private readonly FakeAccessPermissionDirectory _directory = new();
    private readonly FakeAccessAuditStore _audit = new();
    private readonly FakeSpeakerOnboardingDirectory _onboarding;

    public SpeakerAccountServiceTests() => _onboarding = new(_directory);

    [Fact]
    public async Task ExistingExactCaseInsensitiveMatchRequiresExplicitLinkAndNeverResetsOrGrants()
    {
        var (service, actor) = Create();
        AddTarget("SPEAKER@example.test");
        var read = await service.ReadAsync(actor, _store.Profile.WorkshopSpeakerId, TestContext.Current.CancellationToken);
        Assert.Single(read.Candidates);
        Assert.Null(read.Account);
        Assert.Equal(0, _store.Links);
        Assert.Equal("speaker_existing_account_requires_link", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            CreateAccount(service, actor))).Code);
        await Link(service, actor);
        Assert.Equal(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.AccountSubject);
        Assert.Equal(0, _onboarding.Creates);
        Assert.Equal(0, _onboarding.Invitations);
        Assert.Equal(0, _directory.Writes);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ResendInvitationAsync(actor,
            _store.Profile.WorkshopSpeakerId, new(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.Email),
            "resend-invitation", TestContext.Current.CancellationToken));
        _store.Profile.Email = "edited@example.test";
        Assert.NotNull((await service.ReadAsync(actor, _store.Profile.WorkshopSpeakerId,
            TestContext.Current.CancellationToken)).Account);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor));
    }

    [Theory]
    [InlineData(false, true, false)]
    [InlineData(true, false, false)]
    [InlineData(true, true, true)]
    public async Task DisabledServiceOrAmbiguousMatchesCannotLink(bool enabled, bool human, bool ambiguous)
    {
        var (service, actor) = Create();
        AddTarget(enabled: enabled, service: !human);
        if (ambiguous) _directory.AddUser(new(_issuer, "33333333-3333-3333-3333-333333333333", "duplicate", true),
            email: _store.Profile.Email);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Link(service, actor));
        Assert.Equal(0, _store.Links);
        Assert.Empty(_audit.Entries);
    }

    [Fact]
    public async Task CreateRequiresPasswordAndVerificationLinksButDoesNotGrantAnything()
    {
        var (service, actor) = Create();
        var status = await CreateAccount(service, actor);
        Assert.Equal("invited", status.OnboardingState);
        Assert.Equal(FakeSpeakerOnboardingDirectory.Subject, status.Account!.Subject);
        Assert.Equal(["UPDATE_PASSWORD", "VERIFY_EMAIL"], _onboarding.SentActions);
        Assert.Equal(1, _onboarding.Creates);
        Assert.Equal(1, _onboarding.Invitations);
        Assert.Equal(0, _directory.Writes);
        Assert.Equal(["speaker-create", "speaker-create", "speaker-link", "speaker-link", "speaker-invite", "speaker-invite"],
            _audit.Entries.Select(entry => entry.Action));
        Assert.Equal(["intent", "verified", "intent", "verified", "intent", "accepted"],
            _audit.Entries.Select(entry => entry.Outcome));
    }

    [Fact]
    public async Task EmailFailureRetainsCreatedAccountAndOnlyExplicitResendRetriesWithoutCreating()
    {
        var (service, actor) = Create();
        _onboarding.FailInvitation = true;
        Assert.Equal("invitation-failed", (await CreateAccount(service, actor)).OnboardingState);
        Assert.NotNull(_store.Profile.AccountSubject);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => CreateAccount(service, actor));
        _onboarding.FailInvitation = false;
        _onboarding.Actions = ["VERIFY_EMAIL"];
        Assert.Equal("invited", (await service.ResendInvitationAsync(actor, _store.Profile.WorkshopSpeakerId,
            new(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.Email), "resend-invitation",
            TestContext.Current.CancellationToken)).OnboardingState);
        Assert.Equal(["VERIFY_EMAIL"], _onboarding.SentActions);
        Assert.Equal(1, _onboarding.Creates);
        Assert.Equal(2, _onboarding.Invitations);
    }

    [Fact]
    public async Task UncertainCreateIsDurablyReservedAndNeverBlindlyRetried()
    {
        var (service, actor) = Create();
        _onboarding.FailCreate = true;
        Assert.Equal("speaker_account_create_uncertain", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            CreateAccount(service, actor))).Code);
        Assert.Equal("create-uncertain", _store.Operation!.State);
        Assert.Equal("unverified", _audit.Entries.Last().Outcome);
        _onboarding.FailCreate = false;
        Assert.Equal("speaker_account_creation_already_attempted", (await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            CreateAccount(service, actor))).Code);
        Assert.Equal(1, _onboarding.Creates);
        Assert.Equal(0, _onboarding.Invitations);
    }

    [Theory]
    [InlineData("speakers.manage")]
    [InlineData("access.users.read")]
    [InlineData("access.users.create")]
    public async Task EveryCreationPermissionIsRequiredAndNondelegable(string missing)
    {
        var (service, actor) = Create(missing);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => CreateAccount(service, actor));
        Assert.Equal(0, _onboarding.Creates);
        Assert.Null(_store.Operation);
        Assert.False(PermissionDelegationPolicy.IsDelegable("access.users.create"));
    }

    [Fact]
    public async Task LinkDoesNotRequireCreationOrGrantPermission()
    {
        var (service, actor) = Create("access.users.create");
        AddTarget();
        await Link(service, actor);
        Assert.Equal(1, _store.Links);
    }

    [Theory]
    [InlineData("mfa")]
    [InlineData("confirmation")]
    [InlineData("stale")]
    [InlineData("configuration")]
    [InlineData("index")]
    [InlineData("audit")]
    public async Task PreconditionsFailBeforeAnyProviderMutation(string failure)
    {
        var (service, actor) = Create(expiredMfa: failure == "mfa");
        _onboarding.BadConfiguration = failure == "configuration";
        _store.HasIndex = failure != "index";
        _audit.FailAppend = failure == "audit";
        await Assert.ThrowsAnyAsync<Exception>(() => service.CreateAndInviteAsync(actor, _store.Profile.WorkshopSpeakerId,
            new(failure == "stale" ? "old@example.test" : _store.Profile.Email),
            failure == "confirmation" ? null : "create-and-invite", TestContext.Current.CancellationToken));
        Assert.Equal(0, _onboarding.Creates);
        Assert.Null(_store.Operation);
    }

    [Fact]
    public async Task ReadbackFailurePreventsInvitationAndReportsUnverifiedLink()
    {
        var (service, actor) = Create();
        _store.IgnoreLink = true;
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => CreateAccount(service, actor));
        Assert.Equal("created", _store.Operation!.State);
        Assert.Equal("unverified", _audit.Entries.Last().Outcome);
        Assert.Equal(0, _onboarding.Invitations);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => CreateAccount(service, actor));
        Assert.Equal(1, _onboarding.Creates);
    }

    [Fact]
    public async Task PendingReservationAfterProcessInterruptionBlocksCreationEvenWithoutAnAccountMatch()
    {
        var (service, actor) = Create();
        _store.Operation = new("prior-attempt", _store.Profile.Email!, "create-pending", null);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => CreateAccount(service, actor));
        Assert.Equal(0, _onboarding.Creates);
        Assert.Equal(0, _onboarding.Invitations);
    }

    [Fact]
    public async Task ConcurrentCreateRequestsCannotBothCreateOrSendEmail()
    {
        var (service, actor) = Create();
        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            try { await CreateAccount(service, actor); return true; }
            catch (PrivacyBlockedException) { return false; }
        }));
        Assert.Single(results, result => result);
        Assert.Equal(1, _onboarding.Creates);
        Assert.Equal(1, _onboarding.Invitations);
    }

    [Fact]
    public async Task ChangedEmailOrCompletedActionsCannotResendAndReadDoesNotSend()
    {
        var (service, actor) = Create();
        await CreateAccount(service, actor);
        _onboarding.Email = "changed@example.test";
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ResendInvitationAsync(actor,
            _store.Profile.WorkshopSpeakerId, new(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.Email),
            "resend-invitation", TestContext.Current.CancellationToken));
        _onboarding.Email = _store.Profile.Email!;
        _onboarding.Actions = [];
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ResendInvitationAsync(actor,
            _store.Profile.WorkshopSpeakerId, new(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.Email),
            "resend-invitation", TestContext.Current.CancellationToken));
        await service.ReadAsync(actor, _store.Profile.WorkshopSpeakerId, TestContext.Current.CancellationToken);
        Assert.Equal(1, _onboarding.Invitations);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ErasureRecordedWhileWaitingForSharedGateBlocksActorOrTargetLink(bool eraseActor)
    {
        var gate = new PrivacyOperationGate();
        var journal = new MemoryErasureJournal();
        var identities = new FakeIdentityAccountAdmin();
        foreach (var subject in new[] { _actorId, FakeSpeakerOnboardingDirectory.Subject })
            identities.Accounts[subject] = new IdentityAccount { Id = subject, Enabled = true };
        var privacy = new PrivacyCoordinator(gate, journal, new FakeAccountPrivacyStore(), identities,
            new FakePrivacySnapshotStore(), Options.Create(new PrivacyOptions { Issuer = _issuer }));
        var (service, actor) = Create(gate: gate, privacy: privacy);
        AddTarget();
        using var lease = await gate.EnterAsync(TestContext.Current.CancellationToken);
        var linking = Link(service, actor);
        Assert.False(linking.IsCompleted);
        var erased = new AccountReference(_issuer, eraseActor ? _actorId : FakeSpeakerOnboardingDirectory.Subject);
        await journal.SaveAsync(new("erasure", erased, "application_erased"), TestContext.Current.CancellationToken);
        lease.Dispose();
        Assert.Equal("account_erasure_in_progress", (await Assert.ThrowsAsync<PrivacyBlockedException>(() => linking)).Code);
        Assert.Equal(0, _store.Links);
        Assert.Empty(_audit.Entries);
    }

    private void AddTarget(string? email = null, bool enabled = true, bool service = false) =>
        _directory.AddUser(new(_issuer, FakeSpeakerOnboardingDirectory.Subject, "speaker", enabled),
            serviceAccount: service, email: email ?? _store.Profile.Email);
    private Task Link(SpeakerAccountService service, ClaimsPrincipal actor) =>
        service.LinkAsync(actor, _store.Profile.WorkshopSpeakerId,
            new(FakeSpeakerOnboardingDirectory.Subject, _store.Profile.Email), "link", TestContext.Current.CancellationToken);
    private Task<SpeakerAccountStatus> CreateAccount(SpeakerAccountService service, ClaimsPrincipal actor) =>
        service.CreateAndInviteAsync(actor, _store.Profile.WorkshopSpeakerId, new(_store.Profile.Email),
            "create-and-invite", TestContext.Current.CancellationToken);
    private (SpeakerAccountService Service, ClaimsPrincipal Actor) Create(string? missing = null, bool expiredMfa = false,
        PrivacyOperationGate? gate = null, PrivacyCoordinator? privacy = null)
    {
        var permissions = new[] { "speakers.read", "speakers.manage", "access.users.read", "access.users.create" }
            .Where(permission => permission != missing).ToArray();
        _directory.AddUser(new(_issuer, _actorId, "operator", true), inherited: permissions);
        var actor = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("iss", _issuer), new Claim("sub", _actorId),
            new Claim("acr", "mfa"), new Claim("auth_time", (expiredMfa ? _now.AddMinutes(-6) : _now)
                .ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)) }
            .Concat(permissions.Select(permission => new Claim("permissions", permission))), "Bearer"));
        return (new(_store, _directory, _onboarding, new(_directory, Options.Create(new PrivacyOptions { Issuer = _issuer })),
            _audit, Options.Create(new PermissionDirectoryOptions { Issuer = _issuer }), new FixedAuthorizationClock(_now),
            gate: gate, privacy: privacy), actor);
    }
}
