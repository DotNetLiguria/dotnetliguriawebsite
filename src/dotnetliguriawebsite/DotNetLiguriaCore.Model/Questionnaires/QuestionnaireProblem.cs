namespace DotNetLiguriaCore.Model;

// Error body returned by the questionnaire APIs; Code is a stable machine-readable value.
public class QuestionnaireProblem
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<QuestionnaireValidationError> Errors { get; set; } = [];
}
