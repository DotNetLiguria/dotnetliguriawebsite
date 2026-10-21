namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterEventProjection
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public DateOnly Date { get; set; }
    public string TimeZone { get; set; } = "";
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? LocationName { get; set; }
    public string? LocationAddress { get; set; }
    public string? MapUrl { get; set; }
    public List<NewsletterTalkProjection> Talks { get; set; } = [];
}
