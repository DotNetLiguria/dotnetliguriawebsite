namespace DotNetLiguriaCore.Model;

public static class QuestionnaireTemplates
{
    public const string OverallQuestionId = "overall";
    public const string UsefulnessQuestionId = "usefulness";
    public const string TracksQuestionId = "tracks";
    public const string TopicsQuestionId = "topics";
    public const string SuggestionsQuestionId = "suggestions";

    public static Questionnaire CreateBlank(string? title, DateTime now) => new()
    {
        QuestionnaireId = Guid.NewGuid(),
        Title = string.IsNullOrWhiteSpace(title) ? "Nuovo questionario" : title.Trim(),
        ThankYouText = "Grazie per aver compilato il questionario!",
        CreatedAt = now,
        UpdatedAt = now,
        Sections = [new QuestionnaireSection { Id = NewId() }],
    };

    // Scales with min 1 are rendered as stars; min 0 (historical forms) as numeric scales.
    public static Questionnaire CreateWorkshopFeedback(Workshop workshop, DateTime now, int min = 1, int max = 5)
    {
        ArgumentNullException.ThrowIfNull(workshop);
        var questionnaire = CreateBlank($"Feedback - {workshop.Title}".TrimEnd(' ', '-'), now);
        questionnaire.WorkshopId = workshop.WorkshopId;
        questionnaire.Description = workshop.Title;
        questionnaire.IntroText = "Grazie di aver partecipato all'evento DotNetLiguria! Il tuo parere ci aiuta a migliorare.";
        questionnaire.ThankYouText = "Grazie per avere espresso il tuo giudizio!";
        questionnaire.DisplayMode = QuestionnaireDisplayMode.SinglePage;

        var ratingType = min == 1 ? QuestionType.Rating : QuestionType.Scale;
        var tracks = (workshop.Tracks ?? []).OrderBy(t => t.StartTime).ToList();

        questionnaire.Sections =
        [
            new QuestionnaireSection
            {
                Id = "event",
                Title = "L'evento",
                Questions =
                [
                    RatingQuestion(OverallQuestionId, ratingType, "L'evento ha soddisfatto le tue aspettative?", min, max),
                    RatingQuestion(UsefulnessQuestionId, ratingType, "Come giudichi il valore e l'utilità delle informazioni ricevute?", min, max),
                ],
            },
            new QuestionnaireSection
            {
                Id = "sessions",
                Title = "Le sessioni",
                Questions = tracks.Count == 0 ? [] :
                [
                    new Question
                    {
                        Id = TracksQuestionId,
                        Type = QuestionType.Matrix,
                        Title = "Come giudichi l'intervento e la preparazione degli speaker?",
                        Required = true,
                        Settings = new QuestionSettings { Min = min, Max = max },
                        Rows = tracks.Select(t => new MatrixRow
                        {
                            Id = t.WorkshopTrackId.ToString("N"),
                            Label = string.IsNullOrWhiteSpace(t.Title) ? "Sessione" : t.Title!,
                            Description = string.IsNullOrWhiteSpace(t.SpeakersName) ? null : t.SpeakersName,
                            WorkshopTrackId = t.WorkshopTrackId,
                        }).ToList(),
                    },
                ],
            },
            new QuestionnaireSection
            {
                Id = "ideas",
                Title = "Suggerimenti",
                Questions =
                [
                    TextQuestion(TopicsQuestionId, "Quali argomenti ti piacerebbero per il prossimo evento?"),
                    TextQuestion(SuggestionsQuestionId, "Hai consigli e/o osservazioni che possano aiutarci a fare meglio?"),
                ],
            },
        ];

        return questionnaire;
    }

    public static string NewId() => Guid.NewGuid().ToString("N");

    private static Question RatingQuestion(string id, QuestionType type, string title, int min, int max) => new()
    {
        Id = id,
        Type = type,
        Title = title,
        Required = true,
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
