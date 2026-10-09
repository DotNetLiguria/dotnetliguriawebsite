namespace DotNetLiguriaCore.Authorization;

public class QuestionnaireAuthorizationOptions
{
    public const string SectionName = "QuestionnaireAuthorization";
    public const string PolicyName = "FeedbackAdmin";

    public string AdminRole { get; set; } = "feedbackadmin";
    public string AdminClaim { get; set; } = "feedbackadmin";
}
