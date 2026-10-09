namespace DotNetLiguriaCore.Model;

public class QuestionnaireSummary
{
    public Guid QuestionnaireId { get; set; }
    public string Title { get; set; } = string.Empty;
    public QuestionnaireStatus Status { get; set; }
    public Guid? WorkshopId { get; set; }
    public string? WorkshopTitle { get; set; }
    public DateTime? OpensAt { get; set; }
    public DateTime? ClosesAt { get; set; }
    public long ResponseCount { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ResponseSource Origin { get; set; }
}
