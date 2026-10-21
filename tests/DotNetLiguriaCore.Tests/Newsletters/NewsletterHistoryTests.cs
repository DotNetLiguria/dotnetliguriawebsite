using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterHistoryTests
{
    [Theory]
    [InlineData("accepted")]
    [InlineData("not-submitted")]
    public async Task PersistedTerminalAttemptWithPendingClaimExposesOnlyItsKnownRecoveryOutcome(string status)
    {
        var fixture = new NewsletterServiceFixture();
        var attempt = new NewsletterAttemptDocument
        {
            Id = Guid.NewGuid(), NewsletterId = fixture.NewsletterId, SnapshotId = fixture.SnapshotId,
            Mode = "production", Status = status, OccurredAt = fixture.Clock.GetUtcNow()
        };
        fixture.Store.Attempts[attempt.Id] = attempt;
        var newsletter = fixture.Store.Newsletters[fixture.NewsletterId];
        newsletter.ProductionAttemptId = attempt.Id;
        newsletter.ProductionStatus = "submitting";

        var history = await fixture.Service.HistoryAsync(fixture.NewsletterId, TestContext.Current.CancellationToken);
        var pending = Assert.Single(history, item => item.Id == attempt.Id.ToString("D"));
        Assert.True(pending.ReconciliationRequired);
        Assert.Equal(status, pending.ReconciliationOutcome);
        var fetched = await fixture.Service.GetAsync(fixture.NewsletterId, TestContext.Current.CancellationToken);
        Assert.True(Assert.Single(fetched!.Attempts!, item => item.Id == pending.Id).ReconciliationRequired);
    }

    [Fact]
    public async Task UncertainTestsCanBeReconciledButAcceptedHistoricalTestsCannot()
    {
        var fixture = new NewsletterServiceFixture();
        var attempt = new NewsletterAttemptDocument
        {
            Id = Guid.NewGuid(), NewsletterId = fixture.NewsletterId, SnapshotId = fixture.SnapshotId,
            Mode = "test", Status = "unknown", OccurredAt = fixture.Clock.GetUtcNow()
        };
        fixture.Store.Attempts[attempt.Id] = attempt;
        var history = await fixture.Service.HistoryAsync(fixture.NewsletterId, TestContext.Current.CancellationToken);
        Assert.True(Assert.Single(history, item => item.Id == attempt.Id.ToString("D")).ReconciliationRequired);
        Assert.False(Assert.Single(history, item => item.Status == "accepted").ReconciliationRequired);
    }

    [Fact]
    public async Task ManuallyCreatedEventDraftCannotPreviewAnIncompleteAnnouncement()
    {
        var fixture = new NewsletterServiceFixture();
        var eventId = Guid.NewGuid();
        var projection = new NewsletterEventProjection { Id = eventId.ToString("D"), Title = "Incomplete" };
        fixture.Events.Events[eventId] = projection;
        var newsletter = fixture.Store.Newsletters[fixture.NewsletterId];
        newsletter.Kind = "event";
        newsletter.EventId = eventId;
        newsletter.EventSnapshot = projection;
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.PreviewAsync(fixture.NewsletterId, new(1), TestContext.Current.CancellationToken));
        Assert.Equal("event_public_details_incomplete", error.Code);
        Assert.Contains("orario di inizio", error.Detail);
        Assert.Contains("orario di fine", error.Detail);
        Assert.Contains("Newsletters:PublicBaseUrl", error.Detail);
    }
}
