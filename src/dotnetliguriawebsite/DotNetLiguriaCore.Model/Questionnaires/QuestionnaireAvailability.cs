using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<QuestionnaireAvailability>))]
public enum QuestionnaireAvailability
{
    Open,
    NotPublished,
    NotYetOpen,
    Closed,
}
