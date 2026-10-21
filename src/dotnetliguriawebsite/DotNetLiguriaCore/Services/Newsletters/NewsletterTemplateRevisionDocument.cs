using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterTemplateRevisionDocument
{
    [BsonId]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TemplateId { get; set; }
    public int Version { get; set; }
    public string Kind { get; set; } = "";
    public string Name { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Markdown { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedByIssuer { get; set; }
    public string? CreatedBySubject { get; set; }
}
