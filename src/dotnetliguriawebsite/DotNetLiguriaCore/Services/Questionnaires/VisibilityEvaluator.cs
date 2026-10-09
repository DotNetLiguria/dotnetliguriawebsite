using System.Globalization;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public static class VisibilityEvaluator
{
    // A question is visible when it has no condition, or when its condition matches the
    // answer of an earlier visible question. Answers of hidden questions count as missing.
    public static HashSet<string> VisibleQuestionIds(Questionnaire questionnaire,
        IReadOnlyDictionary<string, QuestionAnswer> answers)
    {
        var visible = new HashSet<string>(StringComparer.Ordinal);
        var questions = new Dictionary<string, Question>(StringComparer.Ordinal);
        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire))
        {
            questions.TryAdd(question.Id, question);
        }

        foreach (var question in QuestionnaireRules.AllQuestions(questionnaire))
        {
            var condition = question.VisibleIf;
            if (condition is null || string.IsNullOrEmpty(condition.QuestionId))
            {
                visible.Add(question.Id);
                continue;
            }

            questions.TryGetValue(condition.QuestionId, out var source);
            QuestionAnswer? answer = null;
            if (source is not null && visible.Contains(source.Id))
            {
                answers.TryGetValue(source.Id, out answer);
            }

            if (Matches(condition, source, answer))
            {
                visible.Add(question.Id);
            }
        }

        return visible;
    }

    public static bool Matches(VisibilityCondition condition, Question? source, QuestionAnswer? answer)
    {
        var hasValue = QuestionnaireRules.HasValue(answer);
        switch (condition.Operator)
        {
            case ConditionOperator.Answered:
                return hasValue;
            case ConditionOperator.NotAnswered:
                return !hasValue;
        }

        if (!hasValue || source is null || answer is null)
        {
            return false;
        }

        var value = condition.Value?.Trim() ?? string.Empty;
        return condition.Operator switch
        {
            ConditionOperator.Equals => AreEqual(source, answer, value),
            ConditionOperator.NotEquals => !AreEqual(source, answer, value),
            ConditionOperator.Contains => Contains(source, answer, value),
            ConditionOperator.GreaterOrEqual => TryNumber(value, out var ge) && answer.Number >= ge,
            ConditionOperator.LessOrEqual => TryNumber(value, out var le) && answer.Number <= le,
            _ => false,
        };
    }

    private static bool AreEqual(Question source, QuestionAnswer answer, string value)
    {
        if (QuestionnaireRules.IsChoice(source.Type))
        {
            return answer.Choices?.Contains(value, StringComparer.Ordinal) == true;
        }

        if (source.Type == QuestionType.YesNo)
        {
            return answer.Bool.HasValue && bool.TryParse(value, out var expected) && answer.Bool.Value == expected;
        }

        if (QuestionnaireRules.IsNumeric(source.Type))
        {
            return TryNumber(value, out var number) && answer.Number == number;
        }

        return string.Equals(answer.Text?.Trim(), value, StringComparison.OrdinalIgnoreCase);
    }

    private static bool Contains(Question source, QuestionAnswer answer, string value)
    {
        if (QuestionnaireRules.IsChoice(source.Type))
        {
            return answer.Choices?.Contains(value, StringComparer.Ordinal) == true;
        }

        return answer.Text?.Contains(value, StringComparison.OrdinalIgnoreCase) == true;
    }

    private static bool TryNumber(string value, out double number) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out number);
}
