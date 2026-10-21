using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterApprovalTests
{
    [Fact]
    public async Task TestSendingRequiresTheApprovedSnapshotAndNeverContactsSmtpOtherwise()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Store.Newsletters[fixture.NewsletterId].ApprovedSnapshotId = null;
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.TestAsync(
            fixture.NewsletterId, new(1, fixture.SnapshotId, "tester@example.test"), fixture.Principal,
            CancellationToken.None));
        Assert.Equal("newsletter_approval_required", error.Code);
        Assert.Equal(409, error.StatusCode);
        Assert.Equal(0, fixture.Transport.Calls);
    }

    [Fact]
    public async Task ProductionConfirmationRequiresApproval()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Store.Newsletters[fixture.NewsletterId].ApprovedSnapshotId = null;
        var error = await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.ConfirmAsync());
        Assert.Equal("newsletter_approval_required", error.Code);
    }

    [Fact]
    public async Task ApprovalRecordsTheSnapshotAndActorAndIsExposedWithTheTestedSnapshot()
    {
        var fixture = new NewsletterServiceFixture();
        var item = fixture.Store.Newsletters[fixture.NewsletterId];
        item.ApprovedSnapshotId = null;
        item.TestSnapshotId = null;
        var approved = await fixture.Service.ApproveAsync(fixture.NewsletterId, new(1, fixture.SnapshotId),
            fixture.Principal, CancellationToken.None);
        Assert.Equal(fixture.SnapshotId.ToString(), approved.ApprovedSnapshotId);
        Assert.Equal(fixture.Clock.GetUtcNow(), approved.ApprovedAt);
        Assert.Null(approved.TestedSnapshotId);
        Assert.Equal("issuer", item.ApprovedByIssuer);
        Assert.Equal("operator", item.ApprovedBySubject);
        Assert.Equal(1, item.Version);

        fixture.Transport.Completion.SetResult(new("accepted", null));
        await fixture.Service.TestAsync(fixture.NewsletterId, new(1, fixture.SnapshotId, "tester@example.test"),
            fixture.Principal, CancellationToken.None);
        var reloaded = await fixture.Service.GetAsync(fixture.NewsletterId, CancellationToken.None);
        Assert.Equal(fixture.SnapshotId.ToString(), reloaded!.TestedSnapshotId);
    }

    [Fact]
    public async Task EditingRevokesApprovalAndTestState()
    {
        var fixture = new NewsletterServiceFixture();
        var updated = await fixture.Service.UpdateAsync(fixture.NewsletterId, new(1, "Title", "Subject", "Changed"),
            fixture.Principal, CancellationToken.None);
        Assert.Null(updated.ApprovedSnapshotId);
        Assert.Null(updated.TestedSnapshotId);
        var item = fixture.Store.Newsletters[fixture.NewsletterId];
        Assert.Null(item.ApprovedByIssuer);
        Assert.Null(item.TestSnapshotId);
    }

    [Fact]
    public async Task StaleSnapshotsAndFrozenNewslettersCannotBeApproved()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Store.Newsletters[fixture.NewsletterId].ApprovedSnapshotId = null;
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ApproveAsync(fixture.NewsletterId,
            new(2, fixture.SnapshotId), fixture.Principal, CancellationToken.None));
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ApproveAsync(fixture.NewsletterId,
            new(1, Guid.NewGuid()), fixture.Principal, CancellationToken.None));
        fixture.Store.Newsletters[fixture.NewsletterId].ProductionStatus = "accepted";
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ApproveAsync(fixture.NewsletterId,
            new(1, fixture.SnapshotId), fixture.Principal, CancellationToken.None));
        Assert.Null(fixture.Store.Newsletters[fixture.NewsletterId].ApprovedSnapshotId);
    }

    [Fact]
    public async Task ExistingSnapshotCanBeReloadedForTheApprovedPreview()
    {
        var fixture = new NewsletterServiceFixture();
        var preview = await fixture.Service.SnapshotAsync(fixture.NewsletterId, fixture.SnapshotId, CancellationToken.None);
        Assert.Equal(fixture.SnapshotId.ToString("D"), preview.SnapshotId);
        Assert.Equal("Subject", preview.Subject);
    }
}
