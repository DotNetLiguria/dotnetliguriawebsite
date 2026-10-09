namespace DotNetLiguriaCore.Model;

public class SubmitQuestionnaireResponseRequest
{
    public Respondent? Respondent { get; set; }
    public bool ConsentGiven { get; set; }
    public List<QuestionAnswer> Answers { get; set; } = [];

    // Honeypot: real users never see or fill this field.
    public string? Website { get; set; }
}
