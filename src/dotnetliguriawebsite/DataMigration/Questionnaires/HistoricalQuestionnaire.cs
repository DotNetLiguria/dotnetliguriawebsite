using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>Shared conventions for questionnaires rebuilt from legacy data.</summary>
public static class HistoricalQuestionnaire
{
    public const string CreatedBy = "DataMigration";

    public static void MarkAsHistorical(Questionnaire questionnaire, Guid id, string title, ResponseSource origin,
        DateTime firstSubmissionUtc, DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(questionnaire);
        questionnaire.QuestionnaireId = id;
        questionnaire.Title = title;
        questionnaire.Status = QuestionnaireStatus.Closed;
        questionnaire.Origin = origin;
        questionnaire.CreatedBy = CreatedBy;
        questionnaire.CreatedAt = firstSubmissionUtc;
        questionnaire.PublishedAt = firstSubmissionUtc;
        questionnaire.UpdatedAt = nowUtc;

        // Legacy forms did not always collect every answer; historical data must not look invalid.
        foreach (var question in questionnaire.Sections.SelectMany(s => s.Questions))
        {
            question.Required = false;
        }
    }

    /// <summary>Legacy dates were written with local time; unspecified values are treated as local.</summary>
    public static DateTime ToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
}
