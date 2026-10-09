using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<QuestionType>))]
public enum QuestionType
{
    ShortText,
    LongText,
    Email,
    Number,
    Date,
    YesNo,
    SingleChoice,
    MultipleChoice,
    Rating,
    Scale,
    Matrix,
    InfoText,
}
