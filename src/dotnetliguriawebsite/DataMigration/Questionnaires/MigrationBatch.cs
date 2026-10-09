using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>A historical questionnaire with the responses migrated into it.</summary>
public class MigrationBatch
{
    public required Questionnaire Questionnaire { get; init; }
    public List<QuestionnaireResponse> Responses { get; } = [];
    public List<string> Warnings { get; } = [];
}
