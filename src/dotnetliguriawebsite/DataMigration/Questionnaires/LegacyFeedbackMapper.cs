using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>Maps the legacy Mongo Feedback rows of one workshop to a closed historical questionnaire.</summary>
public static class LegacyFeedbackMapper
{
    public const string SourcePrefix = "LegacyFeedback";
    public const string OverallSlot = "overall";
    public static readonly TimeSpan DefaultWindow = TimeSpan.FromSeconds(5);

    public static MigrationBatch Map(Guid workshopId, Workshop? workshop, IReadOnlyCollection<Feedback> rows,
        DateTime nowUtc, TimeSpan? window = null)
    {
        ArgumentNullException.ThrowIfNull(rows);
        if (rows.Count == 0)
        {
            throw new ArgumentException("At least one feedback row is required.", nameof(rows));
        }

        var knownTracks = (workshop?.Tracks ?? []).ToDictionary(t => t.WorkshopTrackId);
        string SlotKey(Feedback f) =>
            knownTracks.ContainsKey(f.WorkshopTrackId) || (workshop is null && !string.IsNullOrWhiteSpace(f.TrackTitle))
                ? f.WorkshopTrackId.ToString("N")
                : OverallSlot;

        var orphanTracks = rows
            .Where(f => SlotKey(f) != OverallSlot && !knownTracks.ContainsKey(f.WorkshopTrackId))
            .GroupBy(f => f.WorkshopTrackId)
            .Select(g => new WorkshopTrack
            {
                WorkshopTrackId = g.Key,
                Title = g.Select(f => f.TrackTitle).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)),
                StartTime = DateTime.MaxValue,
            });

        var title = workshop?.Title
            ?? rows.Select(f => f.WorkshopTitle).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t))
            ?? $"Workshop {workshopId:N}";
        var templateSource = new Workshop
        {
            WorkshopId = workshopId,
            Title = title,
            Tracks = [.. knownTracks.Values, .. orphanTracks],
        };

        var min = rows.Min(f => f.Rating) <= 0 ? 0 : 1;
        var max = Math.Max(5, rows.Max(f => f.Rating));
        var (groups, ambiguous) = LegacyFeedbackGrouper.Group(rows, SlotKey, window ?? DefaultWindow);
        var firstSubmission = ToUtc(rows.Min(f => f.CreatedDate));

        var questionnaire = QuestionnaireTemplates.CreateWorkshopFeedback(templateSource, firstSubmission, min, max);
        RemoveQuestions(questionnaire, QuestionnaireTemplates.UsefulnessQuestionId, QuestionnaireTemplates.TopicsQuestionId);
        HistoricalQuestionnaire.MarkAsHistorical(questionnaire, DeterministicGuid.Create($"{SourcePrefix}|{workshopId:N}"),
            $"Feedback (storico) - {title}", ResponseSource.LegacyFeedback, firstSubmission, nowUtc);

        var batch = new MigrationBatch { Questionnaire = questionnaire };
        if (ambiguous > 0)
        {
            batch.Warnings.Add($"{ambiguous} righe Feedback assegnate in modo ambiguo (stessa nota e orario ravvicinato).");
        }

        if (workshop is null)
        {
            batch.Warnings.Add($"Workshop {workshopId} non trovato: questionario creato senza sessioni note.");
        }

        foreach (var group in groups)
        {
            batch.Responses.Add(MapGroup(questionnaire, group, SlotKey));
        }

        return batch;
    }

    private static QuestionnaireResponse MapGroup(Questionnaire questionnaire, List<Feedback> group, Func<Feedback, string> slotKey)
    {
        var sourceKey = $"{SourcePrefix}:{group.Min(f => f.FeedbackId):N}";
        var answers = new List<QuestionAnswer>();

        var overall = group.FirstOrDefault(f => slotKey(f) == OverallSlot);
        if (overall is not null)
        {
            answers.Add(new QuestionAnswer { QuestionId = QuestionnaireTemplates.OverallQuestionId, Number = overall.Rating });
        }

        var trackRows = group.Where(f => slotKey(f) != OverallSlot)
            .Select(f => new MatrixAnswer { RowId = f.WorkshopTrackId.ToString("N"), Value = f.Rating })
            .ToList();
        if (trackRows.Count > 0)
        {
            answers.Add(new QuestionAnswer { QuestionId = QuestionnaireTemplates.TracksQuestionId, Rows = trackRows });
        }

        var note = group[0].Note?.Trim();
        if (!string.IsNullOrEmpty(note))
        {
            answers.Add(new QuestionAnswer { QuestionId = QuestionnaireTemplates.SuggestionsQuestionId, Text = note });
        }

        return new QuestionnaireResponse
        {
            ResponseId = DeterministicGuid.Create(sourceKey),
            QuestionnaireId = questionnaire.QuestionnaireId,
            QuestionnaireVersion = questionnaire.Version,
            SubmittedAt = ToUtc(group.Min(f => f.CreatedDate)),
            Answers = answers,
            Source = ResponseSource.LegacyFeedback,
            SourceKey = sourceKey,
        };
    }

    private static void RemoveQuestions(Questionnaire questionnaire, params string[] ids)
    {
        foreach (var section in questionnaire.Sections)
        {
            section.Questions.RemoveAll(q => ids.Contains(q.Id));
        }
    }

    private static DateTime ToUtc(DateTime value) => HistoricalQuestionnaire.ToUtc(value);
}
