using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class QuestionAnswer
{
    public string QuestionId { get; set; } = string.Empty;

    [BsonIgnoreIfNull]
    public string? Text { get; set; }

    [BsonIgnoreIfNull]
    public double? Number { get; set; }

    [BsonIgnoreIfNull]
    public bool? Bool { get; set; }

    [BsonIgnoreIfNull]
    public List<string>? Choices { get; set; }

    [BsonIgnoreIfNull]
    public string? OtherText { get; set; }

    [BsonIgnoreIfNull]
    public List<MatrixAnswer>? Rows { get; set; }
}
