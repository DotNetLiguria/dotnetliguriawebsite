using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterServiceStateTests
{
    [Theory]
    [InlineData("accepted", "accepted")]
    [InlineData("not-submitted", "draft")]
    public async Task DurableTerminalAttemptCanRepairFailedClaimCompletionWithoutChangingItsOutcome(
        string result, string expectedProduction)
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Transport.Completion.SetResult(new(result, result == "not-submitted" ? "smtp_connect_failed" : null));
        fixture.Store.BeforeProductionCompletion = (_, _, _) => throw new IOException("Synthetic finalization failure");
        await Assert.ThrowsAsync<IOException>(() => fixture.Service.SendAsync(fixture.NewsletterId,
            request, fixture.Principal, CancellationToken.None));
        var attempt = fixture.Store.Attempts.Values.Single(item => item.Mode == "production");
        Assert.Equal(result, attempt.Status);
        Assert.Equal("submitting", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        var forbiddenOutcome = result == "accepted" ? "not-submitted" : "accepted";
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ReconcileAsync(fixture.NewsletterId,
            fixture.ReconcileRequest(forbiddenOutcome), fixture.Principal, CancellationToken.None));

        // A reconciliation audit write can also succeed before its claim completion fails.
        await Assert.ThrowsAsync<IOException>(() => fixture.Service.ReconcileAsync(fixture.NewsletterId,
            fixture.ReconcileRequest(result), fixture.Principal, CancellationToken.None));
        var auditAt = fixture.Store.Attempts[attempt.Id].ReconciledAt;
        Assert.NotNull(auditAt);
        fixture.Store.BeforeProductionCompletion = null;
        await fixture.Service.ReconcileAsync(fixture.NewsletterId, fixture.ReconcileRequest(result),
            fixture.Principal, CancellationToken.None);
        Assert.Equal(expectedProduction, fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        Assert.Equal(result, fixture.Store.Attempts[attempt.Id].Status);
        Assert.Equal(auditAt, fixture.Store.Attempts[attempt.Id].ReconciledAt);
        Assert.Equal(1, fixture.Transport.Calls);
    }

    [Fact]
    public async Task SuccessfulTestCreatesCurrentApprovalAndEnablesOperatorBoundConfirmation()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Store.Attempts.Clear();
        fixture.Store.Newsletters[fixture.NewsletterId].TestSnapshotId = null;
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.ConfirmAsync());
        fixture.Transport.Completion.SetResult(new("accepted", null));
        var result = await fixture.Service.TestAsync(fixture.NewsletterId,
            new(1, fixture.SnapshotId, "arbitrary-single@example.test"), fixture.Principal, CancellationToken.None);
        Assert.Equal("accepted", result.Status);
        Assert.Equal(fixture.SnapshotId.ToString(), fixture.Store.Newsletters[fixture.NewsletterId].TestSnapshotId);
        var confirmation = await fixture.ConfirmAsync();
        Assert.Equal("issuer|operator", fixture.Store.Confirmations[confirmation.ConfirmationId].Operator);
        Assert.Equal(1, fixture.Transport.Calls);
    }

    [Fact]
    public async Task DistributionAndKnownAliasesCannotReceiveTestMessages()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Options.CurrentValue.DistributionAliases = ["alias@example.test"];
        foreach (var address in new[] { "distribution@example.test", "ALIAS@example.test" })
            await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.TestAsync(fixture.NewsletterId,
                new(1, fixture.SnapshotId, address), fixture.Principal, CancellationToken.None));
        Assert.Equal(0, fixture.Transport.Calls);
    }

    [Fact]
    public async Task LiveSubmissionReleasesSharedGateButSecondClaimIsRejectedAndRequestCancellationCannotCancelSmtp()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        using var callerCancellation = new CancellationTokenSource();
        var sending = fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, callerCancellation.Token);
        await fixture.Transport.Started.Task;
        callerCancellation.Cancel();
        Assert.False(fixture.Transport.SendToken.IsCancellationRequested);
        await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None));
        fixture.Transport.Completion.SetResult(new("accepted", null));
        Assert.Equal("accepted", (await sending).Status);
        Assert.Equal(1, fixture.Transport.Calls);
    }

    [Fact]
    public async Task ProductionPersistsClaimAndConsumesConfirmationBeforeSmtpAndFreezesAccepted()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Transport.OnSending = () =>
        {
            var newsletter = fixture.Store.Newsletters[fixture.NewsletterId];
            Assert.Equal("submitting", newsletter.ProductionStatus);
            Assert.True(newsletter.ConfirmationConsumed);
            Assert.True(fixture.Store.Confirmations[request.ConfirmationId].Consumed);
            var attempt = fixture.Store.Attempts[newsletter.ProductionAttemptId!.Value];
            Assert.Equal("unknown", attempt.Status);
            Assert.Equal(fixture.Options.CurrentValue.SmtpTimeoutSeconds, attempt.SubmissionTimeoutSeconds);
        };
        fixture.Transport.Completion.SetResult(new("accepted", null));
        var result = await fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None);

        Assert.Equal("accepted", result.Status);
        Assert.Equal("accepted", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None));
        Assert.Equal(1, fixture.Transport.Calls);
        Assert.Equal(1, fixture.Store.ProductionClaims);
    }

    [Fact]
    public async Task DefiniteNonSubmissionReturnsToEditableDraftInvalidatesApprovalsAndKeepsFailedHistory()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Transport.Completion.SetResult(new("not-submitted", "smtp_connect_failed"));
        var result = await fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None);

        var newsletter = fixture.Store.Newsletters[fixture.NewsletterId];
        Assert.Equal("draft", newsletter.ProductionStatus);
        Assert.Null(newsletter.ProductionAttemptId);
        Assert.Null(newsletter.TestSnapshotId);
        Assert.Null(newsletter.ConfirmationId);
        Assert.False(newsletter.VisualApproved);
        Assert.Equal("not-submitted", fixture.Store.Attempts[Guid.Parse(result.Id)].Status);
        Assert.Equal("smtp_connect_failed", fixture.Store.Attempts[Guid.Parse(result.Id)].ErrorCode);
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.ConfirmAsync());
        await fixture.Service.UpdateAsync(fixture.NewsletterId, new(1, "Changed", "Changed", "Body"),
            fixture.Principal, CancellationToken.None);
        Assert.Equal(2, fixture.Store.Newsletters[fixture.NewsletterId].Version);
        Assert.Equal("not-submitted", fixture.Store.Attempts[Guid.Parse(result.Id)].Status);
    }

    [Fact]
    public async Task LiveUnknownCannotBeReconciledAndFakeTimeBoundsEvenUncooperativeTransport()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        var sending = fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None);
        await fixture.Transport.Started.Task;
        var reconcile = fixture.ReconcileRequest();

        var blocked = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.ReconcileAsync(fixture.NewsletterId, reconcile, fixture.Principal, CancellationToken.None));
        Assert.Equal("newsletter_attempt_still_settling", blocked.Code);
        fixture.Clock.Advance(TimeSpan.FromSeconds(30));
        var timedOut = await sending;
        Assert.Equal("unknown", timedOut.Status);
        Assert.True(fixture.Transport.SendToken.IsCancellationRequested);
        Assert.Equal("unknown", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);

        fixture.Options.CurrentValue.SmtpTimeoutSeconds = 5;
        fixture.Clock.Advance(TimeSpan.FromSeconds(119));
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ReconcileAsync(fixture.NewsletterId,
            reconcile, fixture.Principal, CancellationToken.None));
        fixture.Clock.Advance(TimeSpan.FromSeconds(1));
        await fixture.Service.ReconcileAsync(fixture.NewsletterId, reconcile, fixture.Principal, CancellationToken.None);
        Assert.Equal("draft", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);

        fixture.Transport.Completion.SetResult(new("accepted", null));
        Assert.Equal("not-submitted", fixture.Store.Attempts[reconcile.AttemptId].Status);
        Assert.Equal("draft", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        Assert.Equal(1, fixture.Transport.Calls);
    }

    [Fact]
    public async Task AcceptedReconciliationIsAuditedFrozenAndNeverRetransmits()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Transport.Completion.SetResult(new("unknown", "smtp_ambiguous"));
        await fixture.Service.SendAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None);
        var reconcile = fixture.ReconcileRequest("accepted");
        fixture.Clock.Advance(TimeSpan.FromMinutes(3));
        await fixture.Service.ReconcileAsync(fixture.NewsletterId, reconcile, fixture.Principal, CancellationToken.None);

        var stored = fixture.Store.Attempts[reconcile.AttemptId];
        Assert.Equal("accepted", stored.Status);
        Assert.Equal("operator", stored.ReconciledBySubject);
        Assert.Equal(reconcile.Reason, stored.ReconciliationReason);
        Assert.Equal("accepted", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ReconcileAsync(fixture.NewsletterId,
            reconcile, fixture.Principal, CancellationToken.None));
        Assert.Equal(1, fixture.Transport.Calls);
    }

    [Fact]
    public async Task StaleSmtpAttemptCompareAndSwapCannotOverwriteReconciliation()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Transport.Completion.SetResult(new("accepted", null));
        fixture.Store.BeforeAttemptUpdate = attempt =>
        {
            fixture.Store.BeforeAttemptUpdate = null;
            var stored = fixture.Store.Attempts[attempt.Id];
            stored.Status = "not-submitted";
            stored.ReconciledAt = fixture.Clock.GetUtcNow();
        };
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.SendAsync(fixture.NewsletterId,
            request, fixture.Principal, CancellationToken.None));
        Assert.Equal("not-submitted", fixture.Store.Attempts.Values.Single(item => item.Mode == "production").Status);
        Assert.Equal("submitting", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
    }

    [Fact]
    public async Task OldProductionCompletionCannotOverwriteNewClaim()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        var newerAttemptId = Guid.NewGuid();
        fixture.Transport.Completion.SetResult(new("not-submitted", "smtp_connect_failed"));
        fixture.Store.BeforeProductionCompletion = (id, _, _) =>
        {
            fixture.Store.BeforeProductionCompletion = null;
            fixture.Store.Newsletters[id].ProductionAttemptId = newerAttemptId;
        };
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.SendAsync(fixture.NewsletterId,
            request, fixture.Principal, CancellationToken.None));
        Assert.Equal("submitting", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        Assert.Equal(newerAttemptId, fixture.Store.Newsletters[fixture.NewsletterId].ProductionAttemptId);
    }

    [Fact]
    public async Task DurableAttemptFailureNeverCallsSmtpAndRetainsRecoverableClaim()
    {
        var fixture = new NewsletterServiceFixture();
        var request = await fixture.ConfirmAsync();
        fixture.Store.FailAttemptInsert = true;
        await Assert.ThrowsAsync<IOException>(() => fixture.Service.SendAsync(fixture.NewsletterId,
            request, fixture.Principal, CancellationToken.None));
        Assert.Equal(0, fixture.Transport.Calls);
        Assert.Equal("submitting", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        fixture.Store.FailAttemptInsert = false;
        fixture.Clock.Advance(TimeSpan.FromMinutes(4));
        await fixture.Service.ReconcileAsync(fixture.NewsletterId, fixture.ReconcileRequest(),
            fixture.Principal, CancellationToken.None);
        Assert.Equal("draft", fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus);
        Assert.Equal(0, fixture.Transport.Calls);
    }

    [Fact]
    public async Task StoreReadsAreClonedAndStaleUpdateCannotLeakMutations()
    {
        var fixture = new NewsletterServiceFixture();
        var read = await fixture.Store.GetNewsletterAsync(fixture.NewsletterId, CancellationToken.None);
        read!.Title = "Not persisted";
        Assert.Equal("Title", fixture.Store.Newsletters[fixture.NewsletterId].Title);
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.UpdateAsync(fixture.NewsletterId,
            new(99, "New title", "New subject", "New body"), fixture.Principal, CancellationToken.None));
        Assert.Equal("Title", fixture.Store.Newsletters[fixture.NewsletterId].Title);
    }
}
