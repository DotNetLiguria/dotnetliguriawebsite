using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class WorkshopAgendaTrack
{
    [BsonId]
    public Guid WorkshopAgendaTrackId { get; set; } = Guid.NewGuid();
    public string? Name { get; set; }
    public int Order { get; set; }
}
