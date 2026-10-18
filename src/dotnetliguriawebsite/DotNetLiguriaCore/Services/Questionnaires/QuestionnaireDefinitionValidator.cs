using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

// Integrity checks always run on save; completeness checks run only before publishing.
public static class QuestionnaireDefinitionValidator
{
    public const int MaxTitleLength = 200;

    public static List<QuestionnaireValidationError> Validate(Questionnaire questionnaire, bool forPublish)
    {
        var errors = new List<QuestionnaireValidationError>();
        if (string.IsNullOrWhiteSpace(questionnaire.Title))
        {
            errors.Add(new(null, "title", "Il titolo è obbligatorio."));
        }
        else if (questionnaire.Title.Length > MaxTitleLength)
        {
            errors.Add(new(null, "title", $"Il titolo non può superare {MaxTitleLength} caratteri."));
        }

        if (questionnaire.OpensAt.HasValue && questionnaire.ClosesAt.HasValue &&
            questionnaire.OpensAt >= questionnaire.ClosesAt)
        {
            errors.Add(new(null, "closesAt", "La data di chiusura deve seguire quella di apertura."));
        }

        if ((questionnaire.OnePerEmail || questionnaire.OnePerAccount) &&
            questionnaire.RespondentMode == RespondentMode.Anonymous)
        {
            errors.Add(new(null, "onePerEmail", "Una risposta per account richiede l'accesso con Keycloak."));
        }
        if (!Enum.IsDefined(questionnaire.RespondentMode))
            errors.Add(new(null, "respondentMode", "Modalità rispondenti non valida."));
        if (questionnaire.Sections is null || questionnaire.Sections.Any(section => section is null ||
            section.Questions is null || section.Questions.Any(question => question is null ||
                question.Settings is null || question.Options is null || question.Rows is null ||
                question.Options.Any(option => option is null) || question.Rows.Any(row => row is null))))
        {
            errors.Add(new(null, "sections", "La struttura non può contenere valori nulli."));
            return errors;
        }
        if (questionnaire.Sections.Count > 30 ||
            questionnaire.Sections.Sum(section => section.Questions.Count) > 200)
        {
            errors.Add(new(null, "sections", "Massimo 30 sezioni e 200 domande."));
            return errors;
        }
        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire))
        {
            if (!Enum.IsDefined(question.Type) || question.Options.Count > 100 || question.Rows.Count > 50 ||
                question.Title?.Length > 2000 || question.HelpText?.Length > 10000 ||
                question.Options.Any(option => option.Label?.Length > 2000) ||
                question.Rows.Any(row => row.Label?.Length > 2000))
                errors.Add(new(question.Id, "definition", "Tipo, dimensioni o numero di opzioni non validi."));
        }

        CheckIdentifiers(questionnaire, errors);
        if (!forPublish)
        {
            return errors;
        }

        var ordered = QuestionnaireRules.AllQuestions(questionnaire).ToList();
        if (!ordered.Any(q => QuestionnaireRules.IsAnswerable(q.Type)))
        {
            errors.Add(new(null, "sections", "Aggiungi almeno una domanda."));
        }

        for (var index = 0; index < ordered.Count; index++)
        {
            ValidateQuestion(ordered[index], ordered.Take(index).ToList(), errors);
        }

        return errors;
    }

    private static void CheckIdentifiers(Questionnaire questionnaire, List<QuestionnaireValidationError> errors)
    {
        var sectionIds = new HashSet<string>(StringComparer.Ordinal);
        var questionIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var section in questionnaire.Sections)
        {
            if (string.IsNullOrWhiteSpace(section.Id) || !sectionIds.Add(section.Id))
            {
                errors.Add(new(null, "sections", "Ogni sezione deve avere un identificativo univoco."));
            }

            foreach (var question in section.Questions)
            {
                if (string.IsNullOrWhiteSpace(question.Id) || question.Id == QuestionnaireRules.OtherOptionId ||
                    !questionIds.Add(question.Id))
                {
                    errors.Add(new(question.Id, "id", "Ogni domanda deve avere un identificativo univoco."));
                }

                if (HasDuplicates(question.Options.Select(o => o.Id)) || question.Options.Any(o => o.Id == QuestionnaireRules.OtherOptionId))
                {
                    errors.Add(new(question.Id, "options", "Le opzioni devono avere identificativi univoci."));
                }

                if (HasDuplicates(question.Rows.Select(r => r.Id)))
                {
                    errors.Add(new(question.Id, "rows", "Le righe devono avere identificativi univoci."));
                }
            }
        }
    }

    private static bool HasDuplicates(IEnumerable<string> ids)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        return ids.Any(id => string.IsNullOrWhiteSpace(id) || !seen.Add(id));
    }

    private static void ValidateQuestion(Question question, List<Question> previous, List<QuestionnaireValidationError> errors)
    {
        void Add(string field, string message) => errors.Add(new(question.Id, field, message));

        if (question.Type == QuestionType.InfoText)
        {
            if (string.IsNullOrWhiteSpace(question.Title) && string.IsNullOrWhiteSpace(question.HelpText))
            {
                Add("title", "Il blocco di testo è vuoto.");
            }
        }
        else if (string.IsNullOrWhiteSpace(question.Title))
        {
            Add("title", "Il testo della domanda è obbligatorio.");
        }

        var settings = question.Settings;
        switch (question.Type)
        {
            case QuestionType.SingleChoice:
            case QuestionType.MultipleChoice:
                ValidateOptions(question, Add);
                break;
            case QuestionType.Rating:
                var stars = settings.Max ?? 5;
                if (stars < 3 || stars > 10 || stars % 1 != 0)
                {
                    Add("settings.max", "Il numero di stelle deve essere tra 3 e 10.");
                }

                break;
            case QuestionType.Scale:
            case QuestionType.Matrix:
                var (min, max) = QuestionnaireRules.ScaleBounds(question);
                if (min >= max || max - min > 10 || min < 0)
                {
                    Add("settings", "La scala deve avere minimo ≥ 0, minimo < massimo e al più 11 valori.");
                }

                if (question.Type == QuestionType.Matrix)
                {
                    if (question.Rows.Count == 0)
                    {
                        Add("rows", "Aggiungi almeno una riga.");
                    }

                    if (question.Rows.Any(r => string.IsNullOrWhiteSpace(r.Label)))
                    {
                        Add("rows", "Ogni riga deve avere un'etichetta.");
                    }
                }

                break;
            case QuestionType.Number:
                if (settings.Min.HasValue && settings.Max.HasValue && settings.Min > settings.Max)
                {
                    Add("settings", "Il minimo non può superare il massimo.");
                }

                break;
            case QuestionType.ShortText:
            case QuestionType.LongText:
                if (settings.MaxLength is < 1 or > 10000)
                {
                    Add("settings.maxLength", "La lunghezza massima deve essere tra 1 e 10000.");
                }

                break;
        }

        if (question.VisibleIf is not null)
        {
            ValidateCondition(question.VisibleIf, previous, Add);
        }
    }

    private static void ValidateOptions(Question question, Action<string, string> add)
    {
        if (question.Options.Count < 2)
        {
            add("options", "Servono almeno due opzioni.");
        }

        if (question.Options.Any(o => string.IsNullOrWhiteSpace(o.Label)))
        {
            add("options", "Ogni opzione deve avere un testo.");
        }
        else if (question.Options.Select(o => o.Label.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != question.Options.Count)
        {
            add("options", "Le opzioni non possono essere duplicate.");
        }

        if (question.Type != QuestionType.MultipleChoice)
        {
            return;
        }

        var available = question.Options.Count + (question.Settings.AllowOther ? 1 : 0);
        var min = question.Settings.MinSelections ?? 0;
        var max = question.Settings.MaxSelections ?? available;
        if (min < 0 || min > max || max > available || max < 1)
        {
            add("settings", "Il numero di selezioni minimo/massimo non è coerente con le opzioni.");
        }
    }

    private static void ValidateCondition(VisibilityCondition condition, List<Question> previous, Action<string, string> add)
    {
        var source = previous.FirstOrDefault(q => q.Id == condition.QuestionId);
        if (source is null || !QuestionnaireRules.IsAnswerable(source.Type))
        {
            add("visibleIf", "La condizione deve riferirsi a una domanda precedente.");
            return;
        }

        var op = condition.Operator;
        if (op is ConditionOperator.Answered or ConditionOperator.NotAnswered)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(condition.Value))
        {
            add("visibleIf", "La condizione richiede un valore.");
            return;
        }

        var compatible = source.Type switch
        {
            QuestionType.Matrix => false,
            QuestionType.SingleChoice or QuestionType.MultipleChoice =>
                op is ConditionOperator.Equals or ConditionOperator.NotEquals or ConditionOperator.Contains &&
                (source.Options.Any(o => o.Id == condition.Value) || condition.Value == QuestionnaireRules.OtherOptionId),
            QuestionType.YesNo => op is ConditionOperator.Equals or ConditionOperator.NotEquals &&
                bool.TryParse(condition.Value, out _),
            QuestionType.Number or QuestionType.Rating or QuestionType.Scale =>
                op is not ConditionOperator.Contains,
            _ => op is ConditionOperator.Equals or ConditionOperator.NotEquals or ConditionOperator.Contains,
        };

        if (!compatible)
        {
            add("visibleIf", "La condizione non è compatibile con il tipo della domanda di riferimento.");
        }
    }
}
