using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public class ResponseValidationResult
{
    public List<QuestionnaireValidationError> Errors { get; } = [];
    public List<QuestionAnswer> Answers { get; } = [];
    public Respondent? Respondent { get; set; }
    public bool IsValid => Errors.Count == 0;
}
