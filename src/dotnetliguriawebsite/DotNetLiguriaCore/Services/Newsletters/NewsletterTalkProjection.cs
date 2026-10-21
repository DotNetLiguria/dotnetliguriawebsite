namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterTalkProjection
{
    public string Title { get; set; } = "";
    public string[] Speakers { get; set; } = [];
    public string? TrackName { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? RoomName { get; set; }
}
