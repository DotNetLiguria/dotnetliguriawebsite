namespace DotNetLiguriaCore.Model;

public class QuestionnaireValidationError
{
    public QuestionnaireValidationError() { }

    public QuestionnaireValidationError(string? questionId, string field, string message)
    {
        QuestionId = questionId;
        Field = field;
        Message = message;
    }

    public string? QuestionId { get; set; }
    public string Field { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
