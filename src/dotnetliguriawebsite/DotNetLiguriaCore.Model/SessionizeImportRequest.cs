namespace DotNetLiguriaCore.Model;

public class SessionizeImportRequest
{
    public string? SessionizeId { get; set; }
    public Dictionary<string, bool>? SpeakerOverwriteDecisions { get; set; } = [];
}
