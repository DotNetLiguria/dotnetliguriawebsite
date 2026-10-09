using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguria.MongoDBModel;

[BsonIgnoreExtraElements]
public class TopMenu
{
    [BsonId]
    public Guid TopMenuElementId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public int Order { get; set; }
    public bool IsActive { get; set; }
}
