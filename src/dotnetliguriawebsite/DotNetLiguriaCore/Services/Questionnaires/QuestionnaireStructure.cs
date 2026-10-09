using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

// Once responses exist, answers must stay interpretable: question ids, types, option ids,
// matrix row ids and scale bounds cannot change. Texts, help, order and settings like
// placeholders remain editable.
public static class QuestionnaireStructure
{
    public static bool IsCompatible(Questionnaire original, Questionnaire updated)
    {
        var before = Describe(original);
        var after = Describe(updated);
        return before.Count == after.Count && before.All(pair =>
            after.TryGetValue(pair.Key, out var value) && value == pair.Value);
    }

    private static Dictionary<string, string> Describe(Questionnaire questionnaire)
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire))
        {
            var (min, max) = QuestionnaireRules.ScaleBounds(question);
            var options = string.Join(',', question.Options.Select(o => o.Id).Order(StringComparer.Ordinal));
            var rows = string.Join(',', question.Rows.Select(r => r.Id).Order(StringComparer.Ordinal));
            result[question.Id] = $"{question.Type}|{min}|{max}|{question.Settings.AllowOther}|{options}|{rows}";
        }

        return result;
    }
}
