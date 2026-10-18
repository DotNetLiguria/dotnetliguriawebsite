namespace DotNetLiguriaCore.Services.Privacy;

public sealed record PersonalDataRecord(
    string Kind, string Id, string? Title, DateTimeOffset? SubmittedAt,
    bool? ConsentGiven, int? QuestionnaireVersion);
