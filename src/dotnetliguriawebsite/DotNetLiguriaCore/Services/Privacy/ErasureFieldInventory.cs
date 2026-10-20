namespace DotNetLiguriaCore.Services.Privacy;

public static class ErasureFieldInventory
{
    public const int Version = 5;
    public static IReadOnlyList<string> DeletableFields { get; } =
    [
        "responses.AccountIssuer", "responses.AccountSubject", "responses.UniqueAccountKey",
        "responses.UniqueEmailKey", "responses.Respondent", "responses.Answers",
        "responses.SubmittedAt", "responses.Source", "responses.SourceKey",
        "responses.ConsentGiven", "responses._id", "responses.QuestionnaireId", "responses.QuestionnaireVersion",
        "responses.Respondent.FirstName", "responses.Respondent.LastName", "responses.Respondent.Email",
        "responses.Answers.*", "responses.*",
        "questionnaires.CreatedBy", "questionnaires.CreatedAt", "questionnaires.UpdatedAt",
        "questionnaires.PublishedAt", "questionnaires.Sections.*", "questionnaires.*",
        "notifications.CreatedBy", "notifications.AccountIssuer", "notifications.AccountSubject",
        "consentHistory.AccountIssuer", "consentHistory.AccountSubject", "consentHistory.*",
        "AccessPermissionAudit.ActorIssuer", "AccessPermissionAudit.ActorSubject",
        "AccessPermissionAudit.TargetIssuer", "AccessPermissionAudit.TargetSubject",
        "AccessPermissionAudit.*", "audit.*", "unknown.*",
        "board.AccountIssuer", "board.AccountSubject",
        "speaker.AccountIssuer", "speaker.AccountSubject",
        "ProfilePhotoSelections.*", "ProfilePhotoAssets.*", "profilePhotoFiles.*",
        "speakerAccountOperations.*"
    ];

    public static string[] BlockingOverrides(PrivacyOptions options) =>
        options.RetentionOverrides
            .Where(pair => !string.Equals(pair.Value, "delete", StringComparison.OrdinalIgnoreCase))
            .Select(pair => pair.Key.Length <= 160 && !pair.Key.Any(char.IsControl) ? pair.Key : "invalid-field-path")
            .Order(StringComparer.Ordinal).ToArray();
}
