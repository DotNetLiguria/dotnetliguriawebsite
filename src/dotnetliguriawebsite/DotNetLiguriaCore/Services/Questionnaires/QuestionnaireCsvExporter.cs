using System.Globalization;
using System.Text;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

// RFC 4180 CSV; the caller prepends a UTF-8 BOM so Excel detects the encoding.
public static class QuestionnaireCsvExporter
{
    public static string Export(Questionnaire questionnaire, IEnumerable<QuestionnaireResponse> responses)
    {
        var columns = new List<(string Header, Func<QuestionnaireResponse, string?> Value)>
        {
            ("ResponseId", r => r.ResponseId.ToString()),
            ("SubmittedAtUtc", r => r.SubmittedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)),
            ("Source", r => r.Source.ToString()),
        };

        if (questionnaire.RespondentMode == RespondentMode.Identified)
        {
            columns.Add(("Nome", r => r.Respondent?.Name));
            columns.Add(("Cognome", r => r.Respondent?.Surname));
            columns.Add(("Email", r => r.Respondent?.Email));
        }

        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire).Where(q => QuestionnaireRules.IsAnswerable(q.Type)))
        {
            if (question.Type == QuestionType.Matrix)
            {
                foreach (var row in question.Rows)
                {
                    columns.Add(($"{question.Title} [{row.Label}]", r => Find(r, question)?.Rows?
                        .FirstOrDefault(x => x.RowId == row.Id)?.Value.ToString(CultureInfo.InvariantCulture)));
                }

                continue;
            }

            columns.Add((question.Title, r => Format(question, Find(r, question))));
            if (question.Settings.AllowOther)
            {
                columns.Add(($"{question.Title} [{question.Settings.OtherLabel ?? "Altro"}]", r => Find(r, question)?.OtherText));
            }
        }

        var builder = new StringBuilder();
        builder.AppendJoin(',', columns.Select(c => Escape(c.Header))).Append("\r\n");
        foreach (var response in responses.OrderBy(r => r.SubmittedAt))
        {
            builder.AppendJoin(',', columns.Select(c => Escape(c.Value(response)))).Append("\r\n");
        }

        return builder.ToString();
    }

    private static QuestionAnswer? Find(QuestionnaireResponse response, Question question) =>
        response.Answers.FirstOrDefault(a => a.QuestionId == question.Id);

    private static string? Format(Question question, QuestionAnswer? answer)
    {
        if (answer is null)
        {
            return null;
        }

        return question.Type switch
        {
            QuestionType.YesNo => answer.Bool switch { true => "Sì", false => "No", _ => null },
            QuestionType.Number or QuestionType.Rating or QuestionType.Scale =>
                answer.Number?.ToString(CultureInfo.InvariantCulture),
            QuestionType.SingleChoice or QuestionType.MultipleChoice => string.Join("; ", (answer.Choices ?? [])
                .Select(id => id == QuestionnaireRules.OtherOptionId
                    ? question.Settings.OtherLabel ?? "Altro"
                    : question.Options.FirstOrDefault(o => o.Id == id)?.Label ?? id)),
            _ => answer.Text,
        };
    }

    // Neutralises spreadsheet formulas (CSV injection) and quotes when needed.
    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        if (value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' && !double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out _))
        {
            value = "'" + value;
        }

        return value.IndexOfAny([',', '"', '\r', '\n']) >= 0
            ? "\"" + value.Replace("\"", "\"\"") + "\""
            : value;
    }
}
