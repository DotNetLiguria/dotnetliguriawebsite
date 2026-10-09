using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class Question
{
    public string Id { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public QuestionType Type { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? HelpText { get; set; }
    public bool Required { get; set; }

    public List<QuestionOption> Options { get; set; } = [];
    public List<MatrixRow> Rows { get; set; } = [];
    public QuestionSettings Settings { get; set; } = new();
    public VisibilityCondition? VisibleIf { get; set; }
}
