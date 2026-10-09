using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Xunit;
using static DotNetLiguriaCore.Tests.Questionnaires.QuestionnaireSamples;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class QuestionnaireResponseValidatorTests
{
    [Fact]
    public void RequiredQuestionsMustBeAnswered()
    {
        var questionnaire = Create(Simple("q1", QuestionType.ShortText, required: true), Simple("q2", QuestionType.ShortText));

        var result = QuestionnaireResponseValidator.Validate(questionnaire, new SubmitQuestionnaireResponseRequest());

        var error = Assert.Single(result.Errors);
        Assert.Equal("q1", error.QuestionId);
    }

    [Fact]
    public void HiddenQuestionsAreNotRequiredAndTheirAnswersAreDropped()
    {
        var condition = new VisibilityCondition { QuestionId = "attended", Operator = ConditionOperator.Equals, Value = "true" };
        var questionnaire = Create(
            Simple("attended", QuestionType.YesNo, required: true),
            Simple("rating", QuestionType.Rating, required: true, visibleIf: condition));
        var request = new SubmitQuestionnaireResponseRequest
        {
            Answers = [Answer("attended", flag: false), Answer("rating", number: 99)],
        };

        var result = QuestionnaireResponseValidator.Validate(questionnaire, request);

        Assert.True(result.IsValid);
        Assert.Equal(["attended"], result.Answers.Select(a => a.QuestionId));
    }

    [Fact]
    public void VisibleConditionalQuestionIsValidated()
    {
        var condition = new VisibilityCondition { QuestionId = "attended", Operator = ConditionOperator.Equals, Value = "true" };
        var questionnaire = Create(
            Simple("attended", QuestionType.YesNo, required: true),
            Simple("rating", QuestionType.Rating, required: true, visibleIf: condition));
        var request = new SubmitQuestionnaireResponseRequest { Answers = [Answer("attended", flag: true)] };

        var result = QuestionnaireResponseValidator.Validate(questionnaire, request);

        Assert.Equal("rating", Assert.Single(result.Errors).QuestionId);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(5, true)]
    [InlineData(6, false)]
    [InlineData(2.5, false)]
    public void RatingMustBeAnIntegerWithinTheStars(double value, bool valid)
    {
        var questionnaire = Create(Simple("r", QuestionType.Rating));
        var request = new SubmitQuestionnaireResponseRequest { Answers = [Answer("r", number: value)] };

        Assert.Equal(valid, QuestionnaireResponseValidator.Validate(questionnaire, request).IsValid);
    }

    [Fact]
    public void UnknownQuestionsAndOptionsAreRejected()
    {
        var questionnaire = Create(Choice("c"));
        var request = new SubmitQuestionnaireResponseRequest { Answers = [Answer("c", choices: "zzz"), Answer("ghost", text: "x")] };

        var result = QuestionnaireResponseValidator.Validate(questionnaire, request);

        Assert.Equal(2, result.Errors.Count);
    }

    [Fact]
    public void MultipleChoiceHonoursSelectionLimitsAndOtherText()
    {
        var question = Choice("m", QuestionType.MultipleChoice);
        question.Settings = new QuestionSettings { MaxSelections = 2, AllowOther = true };
        var questionnaire = Create(question);

        var tooMany = new SubmitQuestionnaireResponseRequest { Answers = [Answer("m", choices: ["a", "b", "c"])] };
        var otherWithoutText = new SubmitQuestionnaireResponseRequest { Answers = [Answer("m", choices: ["a", QuestionnaireRules.OtherOptionId])] };
        var answer = Answer("m", choices: ["a", QuestionnaireRules.OtherOptionId]);
        answer.OtherText = "  Blazor  ";
        var valid = new SubmitQuestionnaireResponseRequest { Answers = [answer] };

        Assert.False(QuestionnaireResponseValidator.Validate(questionnaire, tooMany).IsValid);
        Assert.False(QuestionnaireResponseValidator.Validate(questionnaire, otherWithoutText).IsValid);
        var result = QuestionnaireResponseValidator.Validate(questionnaire, valid);
        Assert.True(result.IsValid);
        Assert.Equal("Blazor", result.Answers[0].OtherText);
    }

    [Fact]
    public void RequiredMatrixNeedsEveryRowInRange()
    {
        var questionnaire = Create(Matrix("tracks"));
        var partial = new QuestionAnswer { QuestionId = "tracks", Rows = [new MatrixAnswer { RowId = "r1", Value = 4 }] };
        var outOfRange = new QuestionAnswer { QuestionId = "tracks", Rows = [new MatrixAnswer { RowId = "r1", Value = 4 }, new MatrixAnswer { RowId = "r2", Value = 9 }] };
        var complete = new QuestionAnswer { QuestionId = "tracks", Rows = [new MatrixAnswer { RowId = "r1", Value = 4 }, new MatrixAnswer { RowId = "r2", Value = 5 }] };

        Assert.False(QuestionnaireResponseValidator.Validate(questionnaire, new() { Answers = [partial] }).IsValid);
        Assert.False(QuestionnaireResponseValidator.Validate(questionnaire, new() { Answers = [outOfRange] }).IsValid);
        Assert.True(QuestionnaireResponseValidator.Validate(questionnaire, new() { Answers = [complete] }).IsValid);
    }

    [Fact]
    public void IdentifiedModeRequiresRespondentAndConsentAndNormalizesEmail()
    {
        var questionnaire = Create(Simple("q", QuestionType.ShortText));
        questionnaire.RespondentMode = RespondentMode.Identified;
        questionnaire.ConsentText = "Privacy";

        var missing = QuestionnaireResponseValidator.Validate(questionnaire, new SubmitQuestionnaireResponseRequest());
        var valid = QuestionnaireResponseValidator.Validate(questionnaire, new SubmitQuestionnaireResponseRequest
        {
            ConsentGiven = true,
            Respondent = new Respondent { Name = " Ada ", Surname = "Lovelace", Email = " Ada@Example.ORG " },
        });

        Assert.Equal(["respondent.name", "respondent.surname", "respondent.email", "consentGiven"], missing.Errors.Select(e => e.Field));
        Assert.True(valid.IsValid);
        Assert.Equal("Ada", valid.Respondent!.Name);
        Assert.Equal("ada@example.org", valid.Respondent.EmailNormalized);
    }

    [Fact]
    public void AnonymousModeIgnoresRespondentData()
    {
        var questionnaire = Create(Simple("q", QuestionType.ShortText));

        var result = QuestionnaireResponseValidator.Validate(questionnaire,
            new SubmitQuestionnaireResponseRequest { Respondent = new Respondent { Email = "a@b.it" } });

        Assert.Null(result.Respondent);
    }

    [Theory]
    [InlineData(QuestionnaireStatus.Draft, null, null, QuestionnaireAvailability.NotPublished)]
    [InlineData(QuestionnaireStatus.Closed, null, null, QuestionnaireAvailability.Closed)]
    [InlineData(QuestionnaireStatus.Published, null, null, QuestionnaireAvailability.Open)]
    [InlineData(QuestionnaireStatus.Published, 1, null, QuestionnaireAvailability.NotYetOpen)]
    [InlineData(QuestionnaireStatus.Published, -2, -1, QuestionnaireAvailability.Closed)]
    [InlineData(QuestionnaireStatus.Published, -1, 1, QuestionnaireAvailability.Open)]
    public void AvailabilityFollowsStatusAndWindow(QuestionnaireStatus status, int? opensInHours, int? closesInHours,
        QuestionnaireAvailability expected)
    {
        var now = new DateTime(2025, 5, 1, 12, 0, 0, DateTimeKind.Utc);
        var questionnaire = Create();
        questionnaire.Status = status;
        questionnaire.OpensAt = opensInHours is { } o ? now.AddHours(o) : null;
        questionnaire.ClosesAt = closesInHours is { } c ? now.AddHours(c) : null;

        Assert.Equal(expected, QuestionnaireResponseValidator.CheckAvailability(questionnaire, now));
    }
}
