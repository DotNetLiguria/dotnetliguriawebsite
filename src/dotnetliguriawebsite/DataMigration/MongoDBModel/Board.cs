using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguria.MongoDBModel;

[BsonIgnoreExtraElements]
public class Board
{
    [BsonId]
    public Guid BoardId { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? ShortBio { get; set; }
    public string? FullBio { get; set; }
    public string? BlogHtml { get; set; }
    public string? LInkedinUrl { get; set; }
    public string? TwitterUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? FaceboookUrl { get; set; }
    public bool IsActive { get; set; }
    public int Order { get; set; }
}