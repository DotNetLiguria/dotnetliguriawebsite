using System.Text.Json;
using DotNetLiguriaCore.Services.Newsletters;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class FakeNewsletterStore : INewsletterStore
{
    public Dictionary<Guid, NewsletterDocument> Newsletters { get; } = [];
    public Dictionary<Guid, NewsletterTemplateDocument> Templates { get; } = [];
    public Dictionary<Guid, NewsletterImageDocument> Images { get; } = [];
    public Dictionary<Guid, NewsletterSnapshotDocument> Snapshots { get; } = [];
    public Dictionary<Guid, NewsletterAttemptDocument> Attempts { get; } = [];
    public Dictionary<string, NewsletterConfirmationDocument> Confirmations { get; } = [];
    public Action<NewsletterAttemptDocument>? BeforeAttemptUpdate { get; set; }
    public Action<Guid, Guid, string>? BeforeProductionCompletion { get; set; }
    public int ProductionClaims { get; private set; }
    public bool FailAttemptInsert { get; set; }

    private static T Clone<T>(T item) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(item))!;
    private static Task<T?> Read<T>(Dictionary<Guid, T> items, Guid id) =>
        Task.FromResult(items.TryGetValue(id, out var value) ? Clone(value) : default);

    public Task<IReadOnlyList<NewsletterDocument>> ListNewslettersAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NewsletterDocument>>(Newsletters.Values.Select(Clone).ToArray());
    public Task<NewsletterDocument?> GetNewsletterAsync(Guid id, CancellationToken cancellationToken) => Read(Newsletters, id);
    public Task<bool> InsertNewsletterAsync(NewsletterDocument newsletter, CancellationToken cancellationToken) =>
        Task.FromResult(Newsletters.TryAdd(newsletter.Id, Clone(newsletter)));
    public Task<bool> ReplaceNewsletterAsync(NewsletterDocument newsletter, int expectedVersion, CancellationToken cancellationToken)
    {
        if (!Newsletters.TryGetValue(newsletter.Id, out var current) || current.Version != expectedVersion ||
            current.ProductionStatus != newsletter.ProductionStatus || current.ContentErased)
            return Task.FromResult(false);
        Newsletters[newsletter.Id] = Clone(newsletter);
        return Task.FromResult(true);
    }
    public Task<bool> TryClaimProductionAsync(Guid newsletterId, int version, Guid snapshotId, Guid attemptId,
        string confirmationId, string generation, string messageId, string recipient, string actorIssuer,
        string actorSubject, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var item = Newsletters[newsletterId];
        if (item.Version != version || item.Archived || item.ProductionStatus != "draft" ||
            item.TestSnapshotId != snapshotId.ToString() || !item.VisualApproved ||
            item.ConfirmationId != confirmationId || item.ConfirmationConsumed ||
            item.ConfirmationExpiresAt <= now || item.ContentErased)
            return Task.FromResult(false);
        item.ProductionStatus = "submitting";
        item.ProductionAttemptId = attemptId;
        item.LastProductionSnapshotId = snapshotId;
        item.ProductionGeneration = generation;
        item.ProductionMessageId = messageId;
        item.ProductionRecipient = recipient;
        item.ProductionActorIssuer = actorIssuer;
        item.ProductionActorSubject = actorSubject;
        item.ProductionStartedAt = now;
        item.ConfirmationConsumed = true;
        ProductionClaims++;
        return Task.FromResult(true);
    }
    public Task<IReadOnlyList<NewsletterTemplateDocument>> ListTemplatesAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NewsletterTemplateDocument>>(Templates.Values.Select(Clone).ToArray());
    public Task<NewsletterTemplateDocument?> GetTemplateAsync(Guid id, CancellationToken cancellationToken) => Read(Templates, id);
    public Task<bool> InsertTemplateAsync(NewsletterTemplateDocument template, CancellationToken cancellationToken) =>
        Task.FromResult(Templates.TryAdd(template.Id, Clone(template)));
    public Task<bool> ReplaceTemplateAsync(NewsletterTemplateDocument template, int expectedVersion, CancellationToken cancellationToken)
    {
        if (!Templates.TryGetValue(template.Id, out var current) || current.Version != expectedVersion)
            return Task.FromResult(false);
        Templates[template.Id] = Clone(template);
        return Task.FromResult(true);
    }
    public Task AddTemplateRevisionAsync(NewsletterTemplateRevisionDocument revision, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<NewsletterTemplateRevisionDocument?> GetTemplateRevisionAsync(Guid templateId, int version, CancellationToken cancellationToken) =>
        Task.FromResult<NewsletterTemplateRevisionDocument?>(null);
    public Task<NewsletterImageDocument?> GetImageAsync(Guid id, CancellationToken cancellationToken) => Read(Images, id);
    public Task AddImageAsync(NewsletterImageDocument image, CancellationToken cancellationToken)
    {
        Images.Add(image.Id, Clone(image));
        return Task.CompletedTask;
    }
    public Task AddSnapshotAsync(NewsletterSnapshotDocument snapshot, CancellationToken cancellationToken)
    {
        Snapshots.Add(snapshot.Id, Clone(snapshot));
        return Task.CompletedTask;
    }
    public Task<NewsletterSnapshotDocument?> GetSnapshotAsync(Guid id, CancellationToken cancellationToken) => Read(Snapshots, id);
    public Task<IReadOnlyList<NewsletterAttemptDocument>> GetAttemptsAsync(Guid newsletterId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NewsletterAttemptDocument>>(Attempts.Values.Where(item => item.NewsletterId == newsletterId)
            .Select(Clone).ToArray());
    public Task<NewsletterAttemptDocument?> GetAttemptAsync(Guid id, CancellationToken cancellationToken) => Read(Attempts, id);
    public Task AddAttemptAsync(NewsletterAttemptDocument attempt, CancellationToken cancellationToken)
    {
        if (FailAttemptInsert) throw new IOException("Synthetic durable write failure.");
        Attempts.Add(attempt.Id, Clone(attempt));
        return Task.CompletedTask;
    }
    public Task<bool> UpdateAttemptAsync(NewsletterAttemptDocument attempt, string expectedStatus, CancellationToken cancellationToken)
    {
        BeforeAttemptUpdate?.Invoke(Clone(attempt));
        if (!Attempts.TryGetValue(attempt.Id, out var current) || current.Status != expectedStatus || current.ReconciledAt is not null)
            return Task.FromResult(false);
        Attempts[attempt.Id] = Clone(attempt);
        return Task.FromResult(true);
    }
    public Task AddConfirmationAsync(NewsletterConfirmationDocument confirmation, CancellationToken cancellationToken)
    {
        Confirmations.Add(confirmation.Id, Clone(confirmation));
        var item = Newsletters[confirmation.NewsletterId];
        item.ConfirmationId = confirmation.Id;
        item.ConfirmationExpiresAt = confirmation.ExpiresAt;
        item.ConfirmationOperator = confirmation.Operator;
        item.ConfirmationConsumed = false;
        item.VisualApproved = true;
        return Task.CompletedTask;
    }
    public Task<NewsletterConfirmationDocument?> GetConfirmationAsync(string id, CancellationToken cancellationToken) =>
        Task.FromResult(Confirmations.TryGetValue(id, out var value) ? Clone(value) : null);
    public Task<bool> ConsumeConfirmationAsync(string id, CancellationToken cancellationToken)
    {
        if (!Confirmations.TryGetValue(id, out var value) || value.Consumed) return Task.FromResult(false);
        value.Consumed = true;
        return Task.FromResult(true);
    }
    public Task SetTestApprovalAsync(Guid newsletterId, int version, Guid snapshotId, CancellationToken cancellationToken)
    {
        var item = Newsletters[newsletterId];
        if (item.Version == version && item.ProductionStatus == "draft")
        {
            item.TestSnapshotId = snapshotId.ToString();
            item.ConfirmationId = null;
            item.VisualApproved = false;
            item.ConfirmationConsumed = false;
        }
        return Task.CompletedTask;
    }
    public Task<bool> CompleteProductionAsync(Guid newsletterId, Guid attemptId, string status, CancellationToken cancellationToken)
    {
        BeforeProductionCompletion?.Invoke(newsletterId, attemptId, status);
        var item = Newsletters[newsletterId];
        if (item.ProductionAttemptId != attemptId || item.ProductionStatus is not ("submitting" or "unknown") || item.ContentErased)
            return Task.FromResult(false);
        item.ProductionStatus = status == "not-submitted" ? "draft" : status;
        if (status == "not-submitted")
        {
            item.ProductionAttemptId = null;
            item.LastProductionSnapshotId = null;
            item.ProductionGeneration = null;
            item.ProductionMessageId = null;
            item.ProductionRecipient = null;
            item.ProductionActorIssuer = null;
            item.ProductionActorSubject = null;
            item.ProductionStartedAt = null;
            item.TestSnapshotId = null;
            item.VisualApproved = false;
            item.ConfirmationId = null;
            item.ConfirmationOperator = null;
            item.ConfirmationExpiresAt = null;
            item.ConfirmationConsumed = false;
        }
        return Task.FromResult(true);
    }
    public Task SeedTemplateAsync(NewsletterTemplateDocument template, NewsletterTemplateRevisionDocument revision, CancellationToken cancellationToken)
    {
        Templates.TryAdd(template.Id, Clone(template));
        return Task.CompletedTask;
    }
    public Task<IReadOnlyList<NewsletterAttemptDocument>> PendingProductionAttemptsAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NewsletterAttemptDocument>>(Attempts.Values.Where(item =>
            item.Mode == "production" && item.Status == "unknown").Select(Clone).ToArray());
    public Task<bool> HasPendingProductionAsync(CancellationToken cancellationToken) =>
        Task.FromResult(Newsletters.Values.Any(item => item.ProductionStatus is "submitting" or "unknown"));
    public Task<IReadOnlyList<string>> InspectAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken) =>
        throw new NotSupportedException();
    public Task<IReadOnlyList<BsonDocument>> ExportAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken) =>
        throw new NotSupportedException();
    public Task EraseAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken) =>
        throw new NotSupportedException();
}
