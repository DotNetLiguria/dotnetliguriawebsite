using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>Pure planning step: turns all legacy sources into historical questionnaire batches.</summary>
public static class QuestionnaireMigrationPlanner
{
    public static List<MigrationBatch> Plan(IEnumerable<Feedback> feedback, IEnumerable<LegacyQuestionarioRow> questionarioRows,
        IReadOnlyDictionary<Guid, Workshop> workshops, DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(feedback);
        ArgumentNullException.ThrowIfNull(questionarioRows);
        ArgumentNullException.ThrowIfNull(workshops);

        var batches = new List<MigrationBatch>();

        foreach (var group in feedback.GroupBy(f => f.WorkshopId).OrderBy(g => g.Key))
        {
            batches.Add(LegacyFeedbackMapper.Map(group.Key, workshops.GetValueOrDefault(group.Key), group.ToList(), nowUtc));
        }

        var sqlGroups = questionarioRows
            .GroupBy(r => (r.Source, Key: LegacyQuestionarioMapper.NormalizeWorkshopKey(r.WorkshopId)))
            .OrderBy(g => g.Key.Source)
            .ThenBy(g => g.Key.Key, StringComparer.Ordinal);
        foreach (var group in sqlGroups)
        {
            var workshop = Guid.TryParse(group.Key.Key, out var workshopId) ? workshops.GetValueOrDefault(workshopId) : null;
            batches.Add(LegacyQuestionarioMapper.Map(group.Key.Source, group.Key.Key, workshop, group.ToList(), nowUtc));
        }

        return batches;
    }
}
