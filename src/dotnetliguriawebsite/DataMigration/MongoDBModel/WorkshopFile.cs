using DotNetLiguria.Models;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Bson;

namespace DotNetLiguria.MongoDBModel
{
    [BsonIgnoreExtraElements]
    public class WorkshopFile
    {
        [BsonId]
        public Guid WorkshopFileId { get; set; }

        public Guid WorkshopId { get; set; }
        public string? Title { get; set; }
        public string? FileName { get; set; }
        public string? FullPath { get; set; }
        public WorkshopFileType FileType { get; set; } // 0 = File, 1 = Image, 2 = Video

    }
}

