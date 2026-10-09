namespace DotNetLiguriaCore.Services.Questionnaires;

public static class PublicQuestionnaireRateLimit
{
    public const string PolicyName = "public-questionnaire";
    public const int PermitLimit = 20;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
}
