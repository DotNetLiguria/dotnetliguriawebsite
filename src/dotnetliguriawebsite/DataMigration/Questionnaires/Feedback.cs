using MongoDB.Bson.Serialization.Attributes;

namespace DataMigration.Questionnaires
{
    [BsonIgnoreExtraElements]
    public class Feedback
    {
        [BsonId]
        public Guid FeedbackId { get; set; }
        public Guid WorkshopId { get; set; }
        public Guid WorkshopTrackId { get; set; }
        public int Rating { get; set; }
        public string? Note { get; set; }
        public string? WorkshopTitle { get; set; }
        public string? TrackTitle { get; set; }
        
        [BsonDateTimeOptions(Kind = DateTimeKind.Local)]
        public DateTime CreatedDate { get; set; }
    }
}
