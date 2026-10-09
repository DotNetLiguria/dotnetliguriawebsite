using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public static class QuestionnaireRules
{
    public const string OtherOptionId = "__other";
    public const int DefaultShortTextLength = 500;
    public const int DefaultLongTextLength = 4000;
    public const int MaxEmailLength = 250;
    public const int MaxNameLength = 50;

    public static bool IsAnswerable(QuestionType type) => type != QuestionType.InfoText;

    public static bool IsNumeric(QuestionType type) =>
        type is QuestionType.Number or QuestionType.Rating or QuestionType.Scale;

    public static bool IsChoice(QuestionType type) =>
        type is QuestionType.SingleChoice or QuestionType.MultipleChoice;

    public static bool IsText(QuestionType type) =>
        type is QuestionType.ShortText or QuestionType.LongText or QuestionType.Email or QuestionType.Date;

    // Integer bounds for Rating (stars), Scale and Matrix questions.
    public static (int Min, int Max) ScaleBounds(Question question) => question.Type switch
    {
        QuestionType.Rating => (1, (int)(question.Settings.Max ?? 5)),
        QuestionType.Scale => ((int)(question.Settings.Min ?? 0), (int)(question.Settings.Max ?? 10)),
        QuestionType.Matrix => ((int)(question.Settings.Min ?? 1), (int)(question.Settings.Max ?? 5)),
        _ => (0, 0),
    };

    public static int TextLimit(Question question) => question.Settings.MaxLength ?? question.Type switch
    {
        QuestionType.LongText => DefaultLongTextLength,
        QuestionType.Email => MaxEmailLength,
        _ => DefaultShortTextLength,
    };

    public static IEnumerable<Question> AllQuestions(Questionnaire questionnaire) =>
        questionnaire.Sections.SelectMany(s => s.Questions);

    public static bool HasValue(QuestionAnswer? answer) =>
        answer is not null &&
        (!string.IsNullOrWhiteSpace(answer.Text) ||
         answer.Number.HasValue ||
         answer.Bool.HasValue ||
         answer.Choices is { Count: > 0 } ||
         answer.Rows is { Count: > 0 } ||
         !string.IsNullOrWhiteSpace(answer.OtherText));

    public static string? NormalizeEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();

    public static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > MaxEmailLength)
        {
            return false;
        }

        var trimmed = email.Trim();
        var at = trimmed.IndexOf('@');
        return at > 0 && at == trimmed.LastIndexOf('@') && at < trimmed.Length - 3 &&
               trimmed.IndexOf('.', at) > at + 1 && !trimmed.EndsWith('.') && !trimmed.Any(char.IsWhiteSpace);
    }
}
