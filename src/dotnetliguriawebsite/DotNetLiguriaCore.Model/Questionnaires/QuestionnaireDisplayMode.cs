using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<QuestionnaireDisplayMode>))]
public enum QuestionnaireDisplayMode
{
    SinglePage,
    Stepper,
}
