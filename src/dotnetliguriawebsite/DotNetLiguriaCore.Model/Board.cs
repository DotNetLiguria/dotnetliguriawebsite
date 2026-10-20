using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class Board
{
    [BsonId]
    public Guid BoardId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ProfileImageUrl { get; set; }
    [BsonIgnore]
    public bool PhotoFallbackDisabled { get; set; }
    [BsonIgnore]
    public string? PhotoVersion { get; set; }
    public string? BlogHtml { get; set; }
    public string? LInkedinUrl { get; set; }
    public string? TwitterUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? FaceboookUrl { get; set; }
    public string? Email { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string? AccountIssuer { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public string? AccountSubject { get; set; }
    public string? InstagramUrl { get; set; }
    public string? ShortBio { get; set; }
    public string? FullBio { get; set; }
    public bool IsActive { get; set; }
    public int Order { get; set; }
}