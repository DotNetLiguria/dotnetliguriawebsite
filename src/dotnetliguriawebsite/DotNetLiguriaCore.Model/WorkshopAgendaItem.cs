using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class WorkshopAgendaItem
{
    [BsonId]
    public Guid WorkshopAgendaItemId { get; set; } = Guid.NewGuid();
    public string? ItemType { get; set; } = "talk";
    public Guid? TalkId { get; set; }
    public Guid? TrackId { get; set; }
    public string? Title { get; set; }
    public string? RoomName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
}
