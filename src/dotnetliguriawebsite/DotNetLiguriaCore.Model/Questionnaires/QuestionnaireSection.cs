namespace DotNetLiguriaCore.Model;

public class QuestionnaireSection
{
    public string Id { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Description { get; set; }
    public List<Question> Questions { get; set; } = [];
}
