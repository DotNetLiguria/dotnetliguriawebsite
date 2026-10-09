namespace DotNetLiguriaCore.Model;

public class TextAnswer
{
    public Guid ResponseId { get; set; }
    public DateTime SubmittedAt { get; set; }
    public string Text { get; set; } = string.Empty;
}
