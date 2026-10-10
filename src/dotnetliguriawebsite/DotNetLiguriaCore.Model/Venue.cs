using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model
{
    public class Venue
    {
        [BsonId]
        public Guid VenueId { get; set; }

        public string? Name { get; set; }
        public string? Coordinates { get; set; }
        public string? Address { get; set; }
        public string? GoogleMapsUrl { get; set; }
        public int MaximumSpaces { get; set; }
    }
}
