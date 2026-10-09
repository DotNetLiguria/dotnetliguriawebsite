using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Bson;

namespace DotNetLiguria.MongoDBModel
{
    [BsonIgnoreExtraElements]
    public class WorkshopTrack
    {
        [BsonId]
        public Guid WorkshopTrackId { get; set; }

        public string? Title { get; set; }
        public string? Image { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? Abstract { get; set; }
        public int Level { get; set; }

        public List<Guid>? Speakers { get; set; }
    }
}