using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<QuestionnaireStatus>))]
public enum QuestionnaireStatus
{
    Draft,
    Published,
    Closed,
    Archived,
}
