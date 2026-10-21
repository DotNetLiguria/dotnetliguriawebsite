using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterConfirmationDocument
{
    [BsonId]
    public string Id { get; set; } = "";
    public Guid NewsletterId { get; set; }
    public int NewsletterVersion { get; set; }
    public Guid SnapshotId { get; set; }
    public string ContentHash { get; set; } = "";
    public string ConfigurationFingerprint { get; set; } = "";
    public string DistributionAddress { get; set; } = "";
    public string Operator { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Consumed { get; set; }
}
