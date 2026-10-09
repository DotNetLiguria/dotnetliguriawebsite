using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>
/// Maps the legacy Blazor QuestionarioTest rows of one workshop and one source database to a closed,
/// identified historical questionnaire. Each track becomes its own Scale question so that the
/// original per-slot ranges (0-5 or 0-10) are preserved.
/// </summary>
public static class LegacyQuestionarioMapper
{
    public const string OverallQuestionId = QuestionnaireTemplates.OverallQuestionId;
    public const string UsefulnessQuestionId = QuestionnaireTemplates.UsefulnessQuestionId;
    public const string TopicsQuestionId = QuestionnaireTemplates.TopicsQuestionId;
    public const string SuggestionsQuestionId = QuestionnaireTemplates.SuggestionsQuestionId;
    public const string UnknownWorkshopKey = "unknown";

    public static string TrackQuestionId(string trackKey) => $"track-{trackKey}";

    public static string NormalizeWorkshopKey(string? workshopId) => NormalizeKey(workshopId) ?? UnknownWorkshopKey;

    public static MigrationBatch Map(ResponseSource source, string workshopKey, Workshop? workshop,
        IReadOnlyCollection<LegacyQuestionarioRow> rows, DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(rows);
        if (source is not (ResponseSource.LegacySqlServer or ResponseSource.LegacySqlite))
        {
            throw new ArgumentOutOfRangeException(nameof(source), source, "Only SQL legacy sources are supported.");
        }

        if (rows.Count == 0)
        {
            throw new ArgumentException("At least one row is required.", nameof(rows));
        }

        var general = LegacyScales.General(source);
        var tracks = rows
            .SelectMany(r => r.Tracks)
            .Select(t => (Key: NormalizeKey(t.WorkshopTrackId), t.Slot))
            .Where(t => t.Key is not null)
            .GroupBy(t => t.Key!)
            .Select(g => new
            {
                Key = g.Key,
                Slot = g.Min(t => t.Slot),
                Max = g.Max(t => LegacyScales.Track(source, t.Slot).Max),
            })
            .OrderBy(t => t.Slot)
            .ThenBy(t => t.Key, StringComparer.Ordinal)
            .ToList();

        var title = workshop?.Title ?? $"Workshop {workshopKey}";
        var sourceLabel = source == ResponseSource.LegacySqlServer ? "SQL Server" : "SQLite";
        var firstSubmission = HistoricalQuestionnaire.ToUtc(rows.Min(r => r.Date));

        var questionnaire = new Questionnaire
        {
            Description = workshop?.Title,
            IntroText = "Questionario storico importato dalla vecchia applicazione Blazor.",
            ThankYouText = "Grazie per avere espresso il tuo giudizio!",
            RespondentMode = RespondentMode.Identified,
            WorkshopId = workshop?.WorkshopId ?? (Guid.TryParse(workshopKey, out var parsed) ? parsed : null),
            Sections =
            [
                new QuestionnaireSection
                {
                    Id = "event",
                    Title = "L'evento",
                    Questions =
                    [
                        ScaleQuestion(OverallQuestionId, "Come giudichi la qualità generale dell'evento?", general.Min, general.Max),
                        ScaleQuestion(UsefulnessQuestionId, "Come giudichi il valore e l'utilità delle informazioni ricevute?", general.Min, general.Max),
                    ],
                },
                new QuestionnaireSection
                {
                    Id = "sessions",
                    Title = "Le sessioni",
                    Questions = tracks.Select(t =>
                    {
                        var track = FindTrack(workshop, t.Key);
                        var question = ScaleQuestion(TrackQuestionId(t.Key),
                            string.IsNullOrWhiteSpace(track?.Title) ? $"Sessione {t.Slot}" : track.Title!, 0, t.Max);
                        question.HelpText = string.IsNullOrWhiteSpace(track?.SpeakersName) ? null : track.SpeakersName;
                        return question;
                    }).ToList(),
                },
                new QuestionnaireSection
                {
                    Id = "ideas",
                    Title = "Suggerimenti",
                    Questions = source == ResponseSource.LegacySqlServer
                        ? [TextQuestion(TopicsQuestionId, "Quali argomenti ti piacerebbero per il prossimo evento?"),
                           TextQuestion(SuggestionsQuestionId, "Hai consigli e/o osservazioni che possano aiutarci a fare meglio?")]
                        : [TextQuestion(TopicsQuestionId, "Quali argomenti ti piacerebbero per il prossimo evento?")],
                },
            ],
        };

        HistoricalQuestionnaire.MarkAsHistorical(questionnaire, DeterministicGuid.Create($"{source}|{workshopKey}"),
            $"Questionario (storico {sourceLabel}) - {title}", source, firstSubmission, nowUtc);

        var batch = new MigrationBatch { Questionnaire = questionnaire };
        if (workshop is null)
        {
            batch.Warnings.Add($"Workshop {workshopKey} non trovato in MongoDB: titoli delle sessioni non disponibili.");
        }

        var outOfRange = 0;
        foreach (var row in rows.OrderBy(r => r.Date).ThenBy(r => r.Id, StringComparer.Ordinal))
        {
            batch.Responses.Add(MapRow(source, questionnaire, row, general, ref outOfRange));
        }

        if (outOfRange > 0)
        {
            batch.Warnings.Add($"{outOfRange} valutazioni fuori scala ignorate.");
        }

        return batch;
    }

    private static QuestionnaireResponse MapRow(ResponseSource source, Questionnaire questionnaire, LegacyQuestionarioRow row,
        (int Min, int Max) general, ref int outOfRange)
    {
        var answers = new List<QuestionAnswer>();
        AddNumber(answers, OverallQuestionId, row.OverallRating, general.Min, general.Max, ref outOfRange);
        AddNumber(answers, UsefulnessQuestionId, row.UsefulnessRating, general.Min, general.Max, ref outOfRange);

        foreach (var track in row.Tracks.OrderBy(t => t.Slot))
        {
            if (NormalizeKey(track.WorkshopTrackId) is { } key)
            {
                var (min, max) = LegacyScales.Track(source, track.Slot);
                AddNumber(answers, TrackQuestionId(key), track.Rating, min, max, ref outOfRange);
            }
        }

        AddText(answers, TopicsQuestionId, row.Topics);
        if (source == ResponseSource.LegacySqlServer)
        {
            AddText(answers, SuggestionsQuestionId, row.Suggestions);
        }

        var sourceKey = $"{source}:{row.Id.Trim()}";
        var email = string.IsNullOrWhiteSpace(row.Email) ? null : row.Email.Trim();
        return new QuestionnaireResponse
        {
            ResponseId = DeterministicGuid.Create(sourceKey),
            QuestionnaireId = questionnaire.QuestionnaireId,
            QuestionnaireVersion = questionnaire.Version,
            SubmittedAt = HistoricalQuestionnaire.ToUtc(row.Date),
            Respondent = new Respondent
            {
                Name = row.Name?.Trim(),
                Surname = row.Surname?.Trim(),
                Email = email,
                EmailNormalized = email?.ToLowerInvariant(),
            },
            Answers = answers,
            Source = source,
            SourceKey = sourceKey,
        };
    }

    private static void AddNumber(List<QuestionAnswer> answers, string questionId, int value, int min, int max, ref int outOfRange)
    {
        if (value < min || value > max)
        {
            outOfRange++;
            return;
        }

        answers.Add(new QuestionAnswer { QuestionId = questionId, Number = value });
    }

    private static void AddText(List<QuestionAnswer> answers, string questionId, string? text)
    {
        if (!string.IsNullOrWhiteSpace(text))
        {
            answers.Add(new QuestionAnswer { QuestionId = questionId, Text = text.Trim() });
        }
    }

    private static WorkshopTrack? FindTrack(Workshop? workshop, string key) =>
        workshop?.Tracks?.FirstOrDefault(t => t.WorkshopTrackId.ToString("N") == key);

    private static string? NormalizeKey(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        if (Guid.TryParse(id, out var guid))
        {
            return guid == Guid.Empty ? null : guid.ToString("N");
        }

        return id.Trim().ToLowerInvariant();
    }

    private static Question ScaleQuestion(string id, string title, int min, int max) => new()
    {
        Id = id,
        Type = QuestionType.Scale,
        Title = title,
        Settings = new QuestionSettings { Min = min, Max = max },
    };

    private static Question TextQuestion(string id, string title) => new()
    {
        Id = id,
        Type = QuestionType.LongText,
        Title = title,
        Settings = new QuestionSettings { MaxLength = 4000 },
    };
}
