using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterTemplateDocument
{
    [BsonId]
    public Guid Id { get; set; }
    public string Kind { get; set; } = "generic";
    public string Name { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Markdown { get; set; } = "";
    public int Version { get; set; } = 1;
    public bool Archived { get; set; }
    public string? CreatedByIssuer { get; set; }
    public string? CreatedBySubject { get; set; }
    public string? UpdatedByIssuer { get; set; }
    public string? UpdatedBySubject { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
