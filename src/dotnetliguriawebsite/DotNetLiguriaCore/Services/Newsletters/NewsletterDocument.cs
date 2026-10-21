using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterDocument
{
    [BsonId]
    public Guid Id { get; set; }
    public string Kind { get; set; } = "generic";
    public string Title { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Markdown { get; set; } = "";
    public Guid? TemplateId { get; set; }
    public int? TemplateVersion { get; set; }
    public Guid? EventId { get; set; }
    public NewsletterEventProjection? EventSnapshot { get; set; }
    public string? OriginId { get; set; }
    public int Version { get; set; } = 1;
    public bool Archived { get; set; }
    public string ProductionStatus { get; set; } = "draft";
    public string? TestSnapshotId { get; set; }
    public bool VisualApproved { get; set; }
    public string? ConfirmationId { get; set; }
    public DateTimeOffset? ConfirmationExpiresAt { get; set; }
    public string? ConfirmationOperator { get; set; }
    public bool ConfirmationConsumed { get; set; }
    public Guid? ProductionAttemptId { get; set; }
    public Guid? LastProductionSnapshotId { get; set; }
    public string? ProductionGeneration { get; set; }
    public string? ProductionMessageId { get; set; }
    public string? ProductionRecipient { get; set; }
    public string? ProductionActorIssuer { get; set; }
    public string? ProductionActorSubject { get; set; }
    public DateTimeOffset? ProductionStartedAt { get; set; }
    public bool ContentErased { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? CreatedByIssuer { get; set; }
    public string? CreatedBySubject { get; set; }
    public string? UpdatedByIssuer { get; set; }
    public string? UpdatedBySubject { get; set; }
}
