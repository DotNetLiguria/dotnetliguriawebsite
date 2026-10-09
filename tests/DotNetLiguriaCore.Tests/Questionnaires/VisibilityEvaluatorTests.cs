using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Xunit;
using static DotNetLiguriaCore.Tests.Questionnaires.QuestionnaireSamples;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class VisibilityEvaluatorTests
{
    [Theory]
    [InlineData(ConditionOperator.Equals, "b", true)]
    [InlineData(ConditionOperator.Equals, "a", false)]
    [InlineData(ConditionOperator.NotEquals, "a", true)]
    [InlineData(ConditionOperator.Answered, null, true)]
    [InlineData(ConditionOperator.NotAnswered, null, false)]
    public void ChoiceConditions(ConditionOperator op, string? value, bool expected)
    {
        var condition = new VisibilityCondition { QuestionId = "c", Operator = op, Value = value };

        Assert.Equal(expected, VisibilityEvaluator.Matches(condition, Choice("c"), Answer("c", choices: "b")));
    }

    [Theory]
    [InlineData(ConditionOperator.GreaterOrEqual, "4", true)]
    [InlineData(ConditionOperator.GreaterOrEqual, "5", false)]
    [InlineData(ConditionOperator.LessOrEqual, "4", true)]
    [InlineData(ConditionOperator.Equals, "4", true)]
    public void NumericConditions(ConditionOperator op, string value, bool expected)
    {
        var condition = new VisibilityCondition { QuestionId = "n", Operator = op, Value = value };

        Assert.Equal(expected, VisibilityEvaluator.Matches(condition, Simple("n", QuestionType.Rating), Answer("n", number: 4)));
    }

    [Fact]
    public void UnansweredSourceOnlyMatchesNotAnswered()
    {
        var source = Simple("t", QuestionType.ShortText);

        Assert.False(VisibilityEvaluator.Matches(new VisibilityCondition { QuestionId = "t", Operator = ConditionOperator.NotEquals, Value = "x" }, source, null));
        Assert.True(VisibilityEvaluator.Matches(new VisibilityCondition { QuestionId = "t", Operator = ConditionOperator.NotAnswered }, source, null));
    }

    [Fact]
    public void TextContainsIsCaseInsensitive()
    {
        var condition = new VisibilityCondition { QuestionId = "t", Operator = ConditionOperator.Contains, Value = "BLAZOR" };

        Assert.True(VisibilityEvaluator.Matches(condition, Simple("t", QuestionType.ShortText), Answer("t", text: "Amo blazor")));
    }

    [Fact]
    public void HiddenQuestionsCascade()
    {
        var questionnaire = Create(
            Simple("a", QuestionType.YesNo),
            Simple("b", QuestionType.ShortText, visibleIf: new VisibilityCondition { QuestionId = "a", Operator = ConditionOperator.Equals, Value = "true" }),
            Simple("c", QuestionType.ShortText, visibleIf: new VisibilityCondition { QuestionId = "b", Operator = ConditionOperator.Answered }));
        var answers = new Dictionary<string, QuestionAnswer>
        {
            ["a"] = Answer("a", flag: false),
            ["b"] = Answer("b", text: "stale"),
        };

        var visible = VisibilityEvaluator.VisibleQuestionIds(questionnaire, answers);

        Assert.Equal(["a"], visible.Order());
    }
}
