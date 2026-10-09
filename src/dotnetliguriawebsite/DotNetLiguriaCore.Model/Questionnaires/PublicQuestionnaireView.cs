namespace DotNetLiguriaCore.Model;

// Public projection: the definition is included only while the questionnaire is open.
public class PublicQuestionnaireView
{
    public Guid QuestionnaireId { get; set; }
    public string Title { get; set; } = string.Empty;
    public QuestionnaireAvailability Availability { get; set; }
    public DateTime? OpensAt { get; set; }
    public DateTime? ClosesAt { get; set; }
    public Questionnaire? Questionnaire { get; set; }
}
