using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterSnapshotDocument
{
    [BsonId]
    public Guid Id { get; set; }
    public Guid NewsletterId { get; set; }
    public int NewsletterVersion { get; set; }
    public string ContentHash { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Html { get; set; } = "";
    public string PlainText { get; set; } = "";
    public List<NewsletterSnapshotImage> Images { get; set; } = [];
    public string LogoDigest { get; set; } = "";
    public string ConfigurationFingerprint { get; set; } = "";
    public string RendererVersion { get; set; } = "";
    public int MessageBytes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
