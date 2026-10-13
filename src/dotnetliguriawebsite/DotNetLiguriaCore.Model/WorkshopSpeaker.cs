using System.Text.Json.Serialization;
using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model
{
    [BsonIgnoreExtraElements]
    public class WorkshopSpeaker
    {
        [BsonId]
        public Guid WorkshopSpeakerId { get; set; }
        public string? Name { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? SessionizeId { get; set; }
        public bool IsActive { get; set; }
        public string? Description { get; set; }
        public string? Email { get; set; }
        [BsonElement("NormalizedName")]
        [JsonIgnore]
        public string NormalizedName { get; set; } = string.Empty;
    }
}
