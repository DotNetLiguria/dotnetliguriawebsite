namespace DotNetLiguriaCore.Model;

public class QuestionnaireStatistics
{
    public Guid QuestionnaireId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int ResponseCount { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? LastResponseAt { get; set; }
    public List<DailyCount> ResponsesPerDay { get; set; } = [];
    public List<QuestionStatistics> Questions { get; set; } = [];
}
