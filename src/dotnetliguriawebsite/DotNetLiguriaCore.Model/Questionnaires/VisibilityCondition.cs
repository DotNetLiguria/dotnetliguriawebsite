using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

public class VisibilityCondition
{
    public string QuestionId { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public ConditionOperator Operator { get; set; }

    public string? Value { get; set; }
}
