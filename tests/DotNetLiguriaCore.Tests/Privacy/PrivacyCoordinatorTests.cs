using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PrivacyCoordinatorTests
{
    private static readonly AccountReference _account = new("https://hello.vevy.com/realms/test", "immutable-subject");

    [Fact]
    public async Task CompletionDeletesIdentityAndRemovesEveryDurableAccountCorrelation()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        var data = new FakeAccountPrivacyStore();
        var snapshots = new FakePrivacySnapshotStore();
        var service = Create(journal, identities, data, snapshots);
        await service.EraseAsync(_account, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
        Assert.Empty(identities.Accounts);
        Assert.Equal(1, data.Erasures);
        Assert.Equal(1, snapshots.Purges);
        Assert.Equal("no_pending_request", await service.StatusAsync(_account, TestContext.Current.CancellationToken));
        await service.EraseAsync(_account, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
    }

    [Fact]
    public async Task FailedSnapshotDeletionCannotDeleteIdentityOrReportCompletionAndRetryWorks()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        var snapshots = new FakePrivacySnapshotStore { FailPurge = true };
        var service = Create(journal, identities, new(), snapshots);
        await Assert.ThrowsAsync<IOException>(() => service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("application_erased", await service.StatusAsync(_account, TestContext.Current.CancellationToken));
        Assert.False(identities.Accounts[_account.Subject].Enabled);
        Assert.Equal(0, identities.Deletions);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.EnsureAccountActiveAsync(_account, TestContext.Current.CancellationToken));
        snapshots.FailPurge = false;
        await service.ResumeAsync(journal.Operations.Single().Key, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
        Assert.Empty(identities.Accounts);
    }

    [Fact]
    public async Task LostIdentityDeletionResponseLeavesRetryableOperation()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        identities.FailDeletion = true;
        var service = Create(journal, identities, new(), new());
        Assert.Equal("awaiting_manual_identity_removal", await service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("awaiting_manual_identity_removal", await service.StatusAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("queued", Assert.Single(journal.Operations.Values).NoticeStatus);
        identities.Accounts.Clear();
        identities.FailDeletion = false;
        await service.EraseAsync(_account, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
    }

    [Fact]
    public async Task ManualModeDisablesErasesAndKeepsOnlyRestrictedPendingTaskUntilVerifiedRemoval()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        var data = new FakeAccountPrivacyStore();
        var snapshots = new FakePrivacySnapshotStore();
        var options = Settings();
        options.AutomaticIdentityDeletion = false;
        var service = Create(journal, identities, data, snapshots, options);
        Assert.Equal("awaiting_manual_identity_removal", await service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.False(identities.Accounts[_account.Subject].Enabled);
        Assert.Equal(0, identities.Deletions);
        Assert.Equal(1, data.Erasures);
        Assert.Equal(1, snapshots.Purges);
        var operation = Assert.Single(journal.Operations.Values);
        Assert.Equal(_account, await service.IdentityForOperationAsync(operation.Id, TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.VerifyIdentityRemovalAsync(operation.Id, TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.EnsureAccountActiveAsync(_account, TestContext.Current.CancellationToken));
        identities.Accounts.Clear();
        await service.VerifyIdentityRemovalAsync(operation.Id, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task UnverifiedOrFailedDisableCannotEraseApplicationData(bool fails)
    {
        var identities = Identities();
        identities.FailDisable = fails;
        identities.LeaveEnabledOnDisable = !fails;
        var data = new FakeAccountPrivacyStore();
        var snapshots = new FakePrivacySnapshotStore();
        var journal = new MemoryErasureJournal();
        var service = Create(journal, identities, data, snapshots);
        await Assert.ThrowsAnyAsync<Exception>(() => service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal(0, data.Erasures);
        Assert.Equal(0, snapshots.Purges);
        Assert.Equal(0, identities.Deletions);
        Assert.Equal("requested", Assert.Single(journal.Operations.Values).Stage);
    }

    [Fact]
    public async Task LostDeleteResponseCompletesOnlyAfterIdentityAbsenceIsVerified()
    {
        var identities = Identities();
        identities.LoseDeleteResponse = true;
        var journal = new MemoryErasureJournal();
        Assert.Equal("completed", await Create(journal, identities, new(), new()).EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Empty(journal.Operations);
    }

    [Fact]
    public async Task UnavailableFinalIdentityVerificationStaysBlockedAndNotifiesAdministrators()
    {
        var identities = Identities();
        identities.FailLookupAfterDeletion = true;
        var journal = new MemoryErasureJournal();
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            Create(journal, identities, new(), new()).EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("identity_disable_not_verified", error.Code);
        Assert.Equal("identity_verification_blocked", Assert.Single(journal.Operations.Values).Stage);
        Assert.Equal("queued", Assert.Single(journal.Operations.Values).NoticeStatus);
    }

    [Fact]
    public async Task NotificationRetryCannotResurrectResolvedTask()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        identities.FailDeletion = true;
        var service = Create(journal, identities, new(), new());
        await service.EraseAsync(_account, TestContext.Current.CancellationToken);
        var operation = Assert.Single(journal.Operations.Values);
        journal.Operations[operation.Id] = operation with { NoticeStatus = "failed", NoticeAttempts = 5, NoticeErrorCode = "smtp_unavailable" };
        await service.RetryNotificationAsync(operation.Id, TestContext.Current.CancellationToken);
        Assert.Equal("queued", journal.Operations[operation.Id].NoticeStatus);
        Assert.Equal(0, journal.Operations[operation.Id].NoticeAttempts);
        identities.Accounts.Clear();
        await service.VerifyIdentityRemovalAsync(operation.Id, TestContext.Current.CancellationToken);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.RetryNotificationAsync(operation.Id, TestContext.Current.CancellationToken));
        Assert.Empty(journal.Operations);
    }

    [Theory]
    [InlineData("responses.Answers", "retain")]
    [InlineData("newSchema.unknown", "safe")]
    [InlineData("responses.AccountSubject", "retain")]
    public async Task ArbitraryUnsafeOverridesBlockBeforeDestructiveWork(string field, string action)
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        var settings = Settings();
        settings.RetentionOverrides[field] = action;
        var service = Create(journal, identities, new(), new(), settings);
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("erasure_preflight_blocked", failure.Code);
        Assert.True(identities.Accounts[_account.Subject].Enabled);
        Assert.Equal("preflight_blocked", Assert.Single(journal.Operations.Values).Stage);
        Assert.Contains("retained:" + field, await service.InspectAsync(_account, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task UnknownOrUnattributableLegacyDataFailsClosed()
    {
        var data = new FakeAccountPrivacyStore { Blockers = ["legacy_respondent_inventory_required", "unassessed_collection"] };
        var identities = Identities();
        var service = Create(new(), identities, data, new());
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.EraseAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal(0, data.Erasures);
        Assert.True(identities.Accounts[_account.Subject].Enabled);
    }

    [Fact]
    public async Task ForeignIssuerIsRejectedWithoutIdentityCalls()
    {
        var identities = Identities();
        var service = Create(new(), identities, new(), new());
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.EraseAsync(new AccountReference("https://foreign.example/realms/test", _account.Subject), TestContext.Current.CancellationToken));
        Assert.Equal(403, failure.StatusCode);
        Assert.Equal(0, identities.Deletions);
    }

    [Fact]
    public async Task OperatorReconciliationCannotDeleteAnExistingIdentity()
    {
        var journal = new MemoryErasureJournal();
        var identities = Identities();
        var service = Create(journal, identities, new(), new());
        var failure = await Assert.ThrowsAsync<PrivacyBlockedException>(() =>
            service.ReconcileDeletedIdentityAsync(_account, TestContext.Current.CancellationToken));
        Assert.Equal("identity_must_already_be_deleted", failure.Code);
        Assert.Empty(journal.Operations);
        identities.Accounts.Clear();
        await service.ReconcileDeletedIdentityAsync(_account, TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
    }

    private static FakeIdentityAccountAdmin Identities()
    {
        var result = new FakeIdentityAccountAdmin();
        result.Accounts[_account.Subject] = new IdentityAccount { Id = _account.Subject, Enabled = true };
        return result;
    }

    internal static PrivacyOptions Settings() => new()
    {
        Issuer = _account.Issuer, AdminClientId = "restricted-service", AdminClientSecret = "synthetic",
        ProtectedStorageApproved = true, ExternalCopiesErasureApproved = true,
        IdentityAttributePermissionsApproved = true, ConsentVersion = "2026-10"
    };

    private static PrivacyCoordinator Create(MemoryErasureJournal journal, FakeIdentityAccountAdmin identities,
        FakeAccountPrivacyStore data, FakePrivacySnapshotStore snapshots, PrivacyOptions? options = null) =>
        new(new PrivacyOperationGate(), journal, data, identities, snapshots, Options.Create(options ?? Settings()));
}
