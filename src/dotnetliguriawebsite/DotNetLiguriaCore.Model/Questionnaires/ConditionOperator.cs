using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<ConditionOperator>))]
public enum ConditionOperator
{
    Equals,
    NotEquals,
    Contains,
    GreaterOrEqual,
    LessOrEqual,
    Answered,
    NotAnswered,
}
