using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class WorkshopTalk
{
    [BsonId]
    public Guid WorkshopTalkId { get; set; } = Guid.NewGuid();
    public string? SessionizeId { get; set; }
    public Guid? TrackId { get; set; }
    public string? Title { get; set; }
    public string? Abstract { get; set; }
    public string? SessionType { get; set; } = "talk";
    public List<WorkshopTalkSpeaker> Speakers { get; set; } = [];
}
