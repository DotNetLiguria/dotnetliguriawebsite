namespace DotNetLiguriaCore.Model;

public class WorkshopTalkSpeaker
{
    public Guid? WorkshopSpeakerId { get; set; }
    public string? SessionizeId { get; set; }
    public string? Name { get; set; }
    public string? ImageUrl { get; set; }
    [MongoDB.Bson.Serialization.Attributes.BsonIgnore]
    public bool PhotoFallbackDisabled { get; set; }
    public string? Biography { get; set; }
}
