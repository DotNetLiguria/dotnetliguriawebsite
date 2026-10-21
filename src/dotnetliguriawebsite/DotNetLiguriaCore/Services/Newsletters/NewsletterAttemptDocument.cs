using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterAttemptDocument
{
    [BsonId]
    public Guid Id { get; set; }
    public Guid NewsletterId { get; set; }
    public Guid SnapshotId { get; set; }
    public string ContentHash { get; set; } = "";
    public string Mode { get; set; } = "";
    public string? Recipient { get; set; }
    public string Status { get; set; } = "unknown";
    public string? ErrorCode { get; set; }
    public string? MessageId { get; set; }
    public string? ActorIssuer { get; set; }
    public string? ActorSubject { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public int SubmissionTimeoutSeconds { get; set; } = 120;
    public string? ReconciliationReason { get; set; }
    public string? ReconciledByIssuer { get; set; }
    public string? ReconciledBySubject { get; set; }
    public DateTimeOffset? ReconciledAt { get; set; }
}
