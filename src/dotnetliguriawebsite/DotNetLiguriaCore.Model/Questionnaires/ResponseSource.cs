using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Model;

[JsonConverter(typeof(JsonStringEnumConverter<ResponseSource>))]
public enum ResponseSource
{
    Web,
    LegacyFeedback,
    LegacySqlServer,
    LegacySqlite,
}
