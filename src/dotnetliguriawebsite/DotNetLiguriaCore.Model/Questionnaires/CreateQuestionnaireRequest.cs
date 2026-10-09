namespace DotNetLiguriaCore.Model;

public class CreateQuestionnaireRequest
{
    // "blank" or "workshopFeedback"
    public string Template { get; set; } = "blank";
    public string? Title { get; set; }
    public Guid? WorkshopId { get; set; }
}
