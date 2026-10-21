using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterImageDocument
{
    [BsonId]
    public Guid Id { get; set; }
    public byte[] Data { get; set; } = [];
    public string ContentType { get; set; } = "";
    public string Digest { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? OwnerIssuer { get; set; }
    public string? OwnerSubject { get; set; }
}
