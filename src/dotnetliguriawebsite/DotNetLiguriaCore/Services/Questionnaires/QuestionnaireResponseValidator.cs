using System.Globalization;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

// Mirrors the client-side validation; the server copy is authoritative.
public static class QuestionnaireResponseValidator
{
    private const string _required = "Risposta obbligatoria.";
    private const string _invalid = "Risposta non valida.";

    public static QuestionnaireAvailability CheckAvailability(Questionnaire questionnaire, DateTime utcNow)
    {
        if (questionnaire.Status == QuestionnaireStatus.Closed || questionnaire.Status == QuestionnaireStatus.Archived)
        {
            return QuestionnaireAvailability.Closed;
        }

        if (questionnaire.Status != QuestionnaireStatus.Published)
        {
            return QuestionnaireAvailability.NotPublished;
        }

        if (questionnaire.OpensAt.HasValue && utcNow < questionnaire.OpensAt.Value)
        {
            return QuestionnaireAvailability.NotYetOpen;
        }

        if (questionnaire.ClosesAt.HasValue && utcNow >= questionnaire.ClosesAt.Value)
        {
            return QuestionnaireAvailability.Closed;
        }

        return QuestionnaireAvailability.Open;
    }

    public static ResponseValidationResult Validate(Questionnaire questionnaire, SubmitQuestionnaireResponseRequest request)
    {
        var result = new ResponseValidationResult();
        ValidateRespondent(questionnaire, request, result);

        var questions = QuestionnaireRules.AllQuestions(questionnaire)
            .Where(q => QuestionnaireRules.IsAnswerable(q.Type))
            .ToDictionary(q => q.Id, StringComparer.Ordinal);
        var answers = new Dictionary<string, QuestionAnswer>(StringComparer.Ordinal);
        foreach (var answer in request.Answers ?? [])
        {
            if (answer is null || !questions.ContainsKey(answer.QuestionId ?? string.Empty))
            {
                result.Errors.Add(new(answer?.QuestionId, "answers", "Domanda sconosciuta."));
            }
            else if (!answers.TryAdd(answer.QuestionId!, answer))
            {
                result.Errors.Add(new(answer.QuestionId, "answers", "Risposta duplicata."));
            }
        }

        var visible = VisibilityEvaluator.VisibleQuestionIds(questionnaire, answers);
        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire))
        {
            if (!QuestionnaireRules.IsAnswerable(question.Type) || !visible.Contains(question.Id))
            {
                continue;
            }

            answers.TryGetValue(question.Id, out var answer);
            if (!QuestionnaireRules.HasValue(answer))
            {
                if (question.Required)
                {
                    result.Errors.Add(new(question.Id, "answers", _required));
                }

                continue;
            }

            var sanitized = Sanitize(question, answer!, out var error);
            if (error is not null)
            {
                result.Errors.Add(new(question.Id, "answers", error));
            }
            else if (sanitized is not null)
            {
                result.Answers.Add(sanitized);
            }
        }

        return result;
    }

    private static void ValidateRespondent(Questionnaire questionnaire, SubmitQuestionnaireResponseRequest request,
        ResponseValidationResult result)
    {
        if (questionnaire.RespondentMode != RespondentMode.Identified)
        {
            return;
        }

        var respondent = request.Respondent ?? new Respondent();
        var name = respondent.Name?.Trim();
        var surname = respondent.Surname?.Trim();
        var email = respondent.Email?.Trim();
        CheckName(name, "respondent.name", "Il nome", result);
        CheckName(surname, "respondent.surname", "Il cognome", result);
        if (!QuestionnaireRules.IsValidEmail(email))
        {
            result.Errors.Add(new(null, "respondent.email", "Inserisci un indirizzo email valido."));
        }

        if (!string.IsNullOrWhiteSpace(questionnaire.ConsentText) && !request.ConsentGiven)
        {
            result.Errors.Add(new(null, "consentGiven", "È necessario accettare l'informativa."));
        }

        result.Respondent = new Respondent
        {
            Name = name,
            Surname = surname,
            Email = email,
            EmailNormalized = QuestionnaireRules.NormalizeEmail(email),
        };
    }

    private static void CheckName(string? value, string field, string label, ResponseValidationResult result)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            result.Errors.Add(new(null, field, $"{label} è obbligatorio."));
        }
        else if (value.Length > QuestionnaireRules.MaxNameLength)
        {
            result.Errors.Add(new(null, field, $"{label} non può superare {QuestionnaireRules.MaxNameLength} caratteri."));
        }
    }

    private static QuestionAnswer? Sanitize(Question question, QuestionAnswer answer, out string? error)
    {
        error = null;
        var clean = new QuestionAnswer { QuestionId = question.Id };
        switch (question.Type)
        {
            case QuestionType.ShortText:
            case QuestionType.LongText:
            case QuestionType.Email:
            case QuestionType.Date:
                var text = answer.Text?.Trim() ?? string.Empty;
                if (text.Length == 0)
                {
                    error = _invalid;
                }
                else if (text.Length > QuestionnaireRules.TextLimit(question))
                {
                    error = $"Massimo {QuestionnaireRules.TextLimit(question)} caratteri.";
                }
                else if (question.Type == QuestionType.Email && !QuestionnaireRules.IsValidEmail(text))
                {
                    error = "Indirizzo email non valido.";
                }
                else if (question.Type == QuestionType.Date &&
                         !DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                {
                    error = "Data non valida.";
                }

                clean.Text = text;
                break;
            case QuestionType.Number:
                if (answer.Number is not { } number || !double.IsFinite(number) ||
                    number < (question.Settings.Min ?? double.MinValue) || number > (question.Settings.Max ?? double.MaxValue))
                {
                    error = "Numero fuori dall'intervallo consentito.";
                }

                clean.Number = answer.Number;
                break;
            case QuestionType.Rating:
            case QuestionType.Scale:
                var (min, max) = QuestionnaireRules.ScaleBounds(question);
                if (!IsIntegerIn(answer.Number, min, max))
                {
                    error = $"Il valore deve essere tra {min} e {max}.";
                }

                clean.Number = answer.Number;
                break;
            case QuestionType.YesNo:
                if (!answer.Bool.HasValue)
                {
                    error = _invalid;
                }

                clean.Bool = answer.Bool;
                break;
            case QuestionType.SingleChoice:
            case QuestionType.MultipleChoice:
                error = SanitizeChoices(question, answer, clean);
                break;
            case QuestionType.Matrix:
                error = SanitizeRows(question, answer, clean);
                break;
            default:
                return null;
        }

        return clean;
    }

    private static string? SanitizeChoices(Question question, QuestionAnswer answer, QuestionAnswer clean)
    {
        var choices = (answer.Choices ?? []).Distinct(StringComparer.Ordinal).ToList();
        var allowed = question.Options.Select(o => o.Id).ToHashSet(StringComparer.Ordinal);
        if (question.Settings.AllowOther)
        {
            allowed.Add(QuestionnaireRules.OtherOptionId);
        }

        if (choices.Count == 0 || choices.Any(c => !allowed.Contains(c)))
        {
            return _invalid;
        }

        if (question.Type == QuestionType.SingleChoice && choices.Count != 1)
        {
            return "Seleziona una sola opzione.";
        }

        if (question.Type == QuestionType.MultipleChoice)
        {
            var min = Math.Max(question.Settings.MinSelections ?? 0, question.Required ? 1 : 0);
            var max = question.Settings.MaxSelections ?? allowed.Count;
            if (choices.Count < min || choices.Count > max)
            {
                return min == max ? $"Seleziona {min} opzioni." : $"Seleziona da {min} a {max} opzioni.";
            }
        }

        clean.Choices = choices;
        if (choices.Contains(QuestionnaireRules.OtherOptionId))
        {
            var other = answer.OtherText?.Trim();
            if (string.IsNullOrEmpty(other))
            {
                return "Specifica il valore per \"Altro\".";
            }

            if (other.Length > QuestionnaireRules.DefaultShortTextLength)
            {
                return $"Massimo {QuestionnaireRules.DefaultShortTextLength} caratteri.";
            }

            clean.OtherText = other;
        }

        return null;
    }

    private static string? SanitizeRows(Question question, QuestionAnswer answer, QuestionAnswer clean)
    {
        var (min, max) = QuestionnaireRules.ScaleBounds(question);
        var rowIds = question.Rows.Select(r => r.Id).ToHashSet(StringComparer.Ordinal);
        var rows = answer.Rows ?? [];
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            if (row is null || !rowIds.Contains(row.RowId ?? string.Empty) || !seen.Add(row.RowId!) || row.Value < min || row.Value > max)
            {
                return $"Ogni valutazione deve essere tra {min} e {max}.";
            }
        }

        if (question.Required && seen.Count != rowIds.Count)
        {
            return "Valuta tutte le righe.";
        }

        clean.Rows = rows.Select(r => new MatrixAnswer { RowId = r.RowId, Value = r.Value }).ToList();
        return null;
    }

    private static bool IsIntegerIn(double? value, int min, int max) =>
        value is { } number && number % 1 == 0 && number >= min && number <= max;
}
