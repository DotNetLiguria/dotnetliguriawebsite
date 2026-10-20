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
        [JsonIgnore]
        public string? AccountIssuer { get; set; }
        [JsonIgnore]
        public string? AccountSubject { get; set; }
        [BsonIgnore]
        public bool PhotoFallbackDisabled { get; set; }
        [BsonIgnore]
        public string? PhotoVersion { get; set; }
        [BsonElement("NormalizedName")]
        [JsonIgnore]
        public string NormalizedName { get; set; } = string.Empty;
    }
}
