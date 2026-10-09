using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Xunit;
using static DotNetLiguriaCore.Tests.Questionnaires.QuestionnaireSamples;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class QuestionnaireDefinitionValidatorTests
{
    [Fact]
    public void DraftSaveOnlyChecksIntegrity()
    {
        var questionnaire = Create(Simple("q1", QuestionType.ShortText), new Question { Id = "q2", Type = QuestionType.SingleChoice });

        Assert.Empty(QuestionnaireDefinitionValidator.Validate(questionnaire, forPublish: false));
        Assert.NotEmpty(QuestionnaireDefinitionValidator.Validate(questionnaire, forPublish: true));
    }

    [Fact]
    public void DuplicateIdsAreRejectedEvenForDrafts()
    {
        var questionnaire = Create(Simple("q1", QuestionType.ShortText), Simple("q1", QuestionType.LongText));

        var errors = QuestionnaireDefinitionValidator.Validate(questionnaire, forPublish: false);

        Assert.Contains(errors, e => e.Field == "id");
    }

    [Fact]
    public void PublishRequiresAnAnswerableQuestion()
    {
        var questionnaire = Create(new Question { Id = "info", Type = QuestionType.InfoText, Title = "Benvenuto" });

        Assert.Contains(QuestionnaireDefinitionValidator.Validate(questionnaire, true), e => e.Field == "sections");
    }

    [Fact]
    public void ChoiceQuestionsNeedTwoDistinctOptions()
    {
        var question = Choice("c");
        question.Options = [new QuestionOption { Id = "a", Label = "Sì" }, new QuestionOption { Id = "b", Label = " sì " }];

        Assert.Contains(QuestionnaireDefinitionValidator.Validate(Create(question), true), e => e.Field == "options");
    }

    [Fact]
    public void ConditionsMustReferenceEarlierQuestionsWithCompatibleOperators()
    {
        var forward = Create(
            Simple("first", QuestionType.ShortText, visibleIf: new VisibilityCondition { QuestionId = "second", Operator = ConditionOperator.Answered }),
            Simple("second", QuestionType.ShortText));
        var incompatible = Create(
            Simple("yes", QuestionType.YesNo),
            Simple("then", QuestionType.ShortText, visibleIf: new VisibilityCondition { QuestionId = "yes", Operator = ConditionOperator.GreaterOrEqual, Value = "1" }));
        var valid = Create(
            Choice("pick"),
            Simple("then", QuestionType.ShortText, visibleIf: new VisibilityCondition { QuestionId = "pick", Operator = ConditionOperator.Equals, Value = "b" }));

        Assert.Contains(QuestionnaireDefinitionValidator.Validate(forward, true), e => e.Field == "visibleIf");
        Assert.Contains(QuestionnaireDefinitionValidator.Validate(incompatible, true), e => e.Field == "visibleIf");
        Assert.Empty(QuestionnaireDefinitionValidator.Validate(valid, true));
    }

    [Fact]
    public void OnePerEmailRequiresIdentifiedRespondents()
    {
        var questionnaire = Create(Simple("q", QuestionType.ShortText));
        questionnaire.OnePerEmail = true;

        Assert.Contains(QuestionnaireDefinitionValidator.Validate(questionnaire, false), e => e.Field == "onePerEmail");
    }

    [Fact]
    public void ScaleBoundsAreChecked()
    {
        var scale = Simple("s", QuestionType.Scale);
        scale.Settings = new QuestionSettings { Min = 5, Max = 5 };

        Assert.Contains(QuestionnaireDefinitionValidator.Validate(Create(scale), true), e => e.Field == "settings");
    }

    [Fact]
    public void WorkshopTemplateIsPublishable()
    {
        var workshop = new Workshop
        {
            WorkshopId = Guid.NewGuid(),
            Title = "Meetup",
            Tracks =
            [
                new WorkshopTrack { WorkshopTrackId = Guid.NewGuid(), Title = "Second", StartTime = new DateTime(2025, 1, 1, 11, 0, 0) },
                new WorkshopTrack { WorkshopTrackId = Guid.NewGuid(), Title = "First", StartTime = new DateTime(2025, 1, 1, 10, 0, 0), SpeakersName = "Ada" },
            ],
        };

        var questionnaire = QuestionnaireTemplates.CreateWorkshopFeedback(workshop, DateTime.UtcNow);

        Assert.Empty(QuestionnaireDefinitionValidator.Validate(questionnaire, true));
        var matrix = QuestionnaireRules.AllQuestions(questionnaire).Single(q => q.Type == QuestionType.Matrix);
        Assert.Equal(["First", "Second"], matrix.Rows.Select(r => r.Label));
        Assert.Equal("Ada", matrix.Rows[0].Description);
        Assert.Equal(workshop.WorkshopId, questionnaire.WorkshopId);
    }
}
