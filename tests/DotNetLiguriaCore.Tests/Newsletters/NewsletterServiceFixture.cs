using System.Security.Claims;
using DotNetLiguriaCore.Services.Newsletters;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterServiceFixture
{
    public FakeNewsletterStore Store { get; } = new();
    public NewsletterTestClock Clock { get; } = new();
    public NewsletterTestOptions Options { get; } = new();
    public ControlledNewsletterTransport Transport { get; } = new();
    public FakeNewsletterEventSource Events { get; } = new();
    public NewsletterService Service { get; }
    public Guid NewsletterId { get; } = Guid.NewGuid();
    public Guid SnapshotId { get; } = Guid.NewGuid();
    public ClaimsPrincipal Principal { get; } = new(new ClaimsIdentity(
        [new Claim("iss", "issuer"), new Claim("sub", "operator")], "Bearer"));

    public NewsletterServiceFixture()
    {
        var environment = new NewsletterTestEnvironment();
        var renderer = new NewsletterRenderer(Store, Options, environment, Clock);
        var gate = new PrivacyOperationGate();
        var identities = new FakeIdentityAccountAdmin();
        identities.Accounts["operator"] = new IdentityAccount { Id = "operator", Enabled = true };
        var privacy = new PrivacyCoordinator(gate, new MemoryErasureJournal(), new FakeAccountPrivacyStore(),
            identities, new FakePrivacySnapshotStore(), Microsoft.Extensions.Options.Options.Create(new PrivacyOptions()));
        Service = new NewsletterService(Store, Events, renderer, Transport, new NewsletterTestRestoreGuard(),
            gate, privacy, Options, environment, Clock);
        Store.Newsletters[NewsletterId] = new NewsletterDocument
        {
            Id = NewsletterId, Title = "Title", Subject = "Subject", Markdown = "Body",
            TestSnapshotId = SnapshotId.ToString(), ApprovedSnapshotId = SnapshotId.ToString(), UpdatedAt = Clock.GetUtcNow()
        };
        Store.Snapshots[SnapshotId] = new NewsletterSnapshotDocument
        {
            Id = SnapshotId, NewsletterId = NewsletterId, NewsletterVersion = 1, Subject = "Subject",
            Html = "<p>Body</p>", PlainText = "Body", ContentHash = "hash",
            ConfigurationFingerprint = renderer.ConfigurationFingerprint()
        };
        var test = new NewsletterAttemptDocument
        {
            Id = Guid.NewGuid(), NewsletterId = NewsletterId, SnapshotId = SnapshotId,
            ContentHash = "hash", Mode = "test", Status = "accepted", OccurredAt = Clock.GetUtcNow()
        };
        Store.Attempts[test.Id] = test;
    }

    public async Task<NewsletterProductionSendRequest> ConfirmAsync()
    {
        var result = await Service.ConfirmAsync(NewsletterId, new(1, SnapshotId, true), Principal, CancellationToken.None);
        return new NewsletterProductionSendRequest(1, SnapshotId, result.ConfirmationId);
    }

    public NewsletterReconcileRequest ReconcileRequest(string outcome = "not-submitted") =>
        new(Store.Newsletters[NewsletterId].ProductionAttemptId!.Value, outcome, "Verified against relay audit.");
}
