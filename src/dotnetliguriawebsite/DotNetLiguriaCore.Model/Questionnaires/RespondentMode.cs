using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<RespondentMode>))]
public enum RespondentMode
{
    Anonymous,
    Identified,
}
