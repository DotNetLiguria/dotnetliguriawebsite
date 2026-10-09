using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguria.MongoDBModel
{

    [BsonIgnoreExtraElements]
    public class FileType
    {
        [BsonId]
        public int FileTypeId { get; set; }
        public string Name { get; set; } = null!;
    }
}
