namespace DotNetLiguriaCore.Services.Newsletters;

public interface INewsletterStore
{
    Task<IReadOnlyList<NewsletterDocument>> ListNewslettersAsync(CancellationToken cancellationToken);
    Task<NewsletterDocument?> GetNewsletterAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> InsertNewsletterAsync(NewsletterDocument newsletter, CancellationToken cancellationToken);
    Task<bool> ReplaceNewsletterAsync(NewsletterDocument newsletter, int expectedVersion, CancellationToken cancellationToken);
    Task<bool> TryClaimProductionAsync(Guid newsletterId, int version, Guid snapshotId, Guid attemptId,
        string confirmationId, string generation, string messageId, string recipient, string actorIssuer,
        string actorSubject, DateTimeOffset now, CancellationToken cancellationToken);
    Task<IReadOnlyList<NewsletterTemplateDocument>> ListTemplatesAsync(CancellationToken cancellationToken);
    Task<NewsletterTemplateDocument?> GetTemplateAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> InsertTemplateAsync(NewsletterTemplateDocument template, CancellationToken cancellationToken);
    Task<bool> ReplaceTemplateAsync(NewsletterTemplateDocument template, int expectedVersion, CancellationToken cancellationToken);
    Task AddTemplateRevisionAsync(NewsletterTemplateRevisionDocument revision, CancellationToken cancellationToken);
    Task<NewsletterTemplateRevisionDocument?> GetTemplateRevisionAsync(Guid templateId, int version, CancellationToken cancellationToken);
    Task<NewsletterImageDocument?> GetImageAsync(Guid id, CancellationToken cancellationToken);
    Task AddImageAsync(NewsletterImageDocument image, CancellationToken cancellationToken);
    Task AddSnapshotAsync(NewsletterSnapshotDocument snapshot, CancellationToken cancellationToken);
    Task<NewsletterSnapshotDocument?> GetSnapshotAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<NewsletterAttemptDocument>> GetAttemptsAsync(Guid newsletterId, CancellationToken cancellationToken);
    Task<NewsletterAttemptDocument?> GetAttemptAsync(Guid id, CancellationToken cancellationToken);
    Task AddAttemptAsync(NewsletterAttemptDocument attempt, CancellationToken cancellationToken);
    Task<bool> UpdateAttemptAsync(NewsletterAttemptDocument attempt, string expectedStatus, CancellationToken cancellationToken);
    Task AddConfirmationAsync(NewsletterConfirmationDocument confirmation, CancellationToken cancellationToken);
    Task<NewsletterConfirmationDocument?> GetConfirmationAsync(string id, CancellationToken cancellationToken);
    Task<bool> ConsumeConfirmationAsync(string id, CancellationToken cancellationToken);
    Task SetTestApprovalAsync(Guid newsletterId, int version, Guid snapshotId, CancellationToken cancellationToken);
    Task<bool> SetApprovalAsync(Guid newsletterId, int version, Guid snapshotId, string actorIssuer,
        string actorSubject, DateTimeOffset now, CancellationToken cancellationToken);
    Task<bool> CompleteProductionAsync(Guid newsletterId, Guid attemptId, string status, CancellationToken cancellationToken);
    Task SeedTemplateAsync(NewsletterTemplateDocument template, NewsletterTemplateRevisionDocument revision,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<NewsletterAttemptDocument>> PendingProductionAttemptsAsync(CancellationToken cancellationToken);
    Task<bool> HasPendingProductionAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<string>> InspectAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken);
    Task<IReadOnlyList<MongoDB.Bson.BsonDocument>> ExportAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken);
    Task EraseAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken);
}
