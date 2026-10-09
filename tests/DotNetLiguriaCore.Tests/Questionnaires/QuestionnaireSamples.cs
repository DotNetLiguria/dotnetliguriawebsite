using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public static class QuestionnaireSamples
{
    public static Questionnaire Create(params Question[] questions) => new()
    {
        QuestionnaireId = Guid.Parse("11111111-2222-3333-4444-555555555555"),
        Title = "Test",
        Sections = [new QuestionnaireSection { Id = "s1", Questions = questions.ToList() }],
    };

    public static Question Choice(string id, QuestionType type = QuestionType.SingleChoice, bool required = false) => new()
    {
        Id = id,
        Type = type,
        Title = id,
        Required = required,
        Options = [new QuestionOption { Id = "a", Label = "A" }, new QuestionOption { Id = "b", Label = "B" }, new QuestionOption { Id = "c", Label = "C" }],
    };

    public static Question Simple(string id, QuestionType type, bool required = false, VisibilityCondition? visibleIf = null) => new()
    {
        Id = id,
        Type = type,
        Title = id,
        Required = required,
        VisibleIf = visibleIf,
    };

    public static Question Matrix(string id, bool required = true) => new()
    {
        Id = id,
        Type = QuestionType.Matrix,
        Title = id,
        Required = required,
        Settings = new QuestionSettings { Min = 1, Max = 5 },
        Rows = [new MatrixRow { Id = "r1", Label = "Row 1" }, new MatrixRow { Id = "r2", Label = "Row 2" }],
    };

    public static QuestionAnswer Answer(string id, string? text = null, double? number = null, bool? flag = null,
        params string[] choices) => new()
    {
        QuestionId = id,
        Text = text,
        Number = number,
        Bool = flag,
        Choices = choices.Length == 0 ? null : choices.ToList(),
    };
}
