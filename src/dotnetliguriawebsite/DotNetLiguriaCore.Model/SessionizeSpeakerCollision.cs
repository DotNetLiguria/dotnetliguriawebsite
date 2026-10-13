namespace DotNetLiguriaCore.Model;

public class SessionizeSpeakerCollision
{
    public string SessionizeId { get; set; } = string.Empty;
    public string? ImportedName { get; set; }
    public Guid ExistingSpeakerId { get; set; }
    public string? ExistingName { get; set; }
}
