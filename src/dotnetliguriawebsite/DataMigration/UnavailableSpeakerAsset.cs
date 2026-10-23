using System.Text.Json.Serialization;

namespace DataMigration;

public sealed class UnavailableSpeakerAsset
{
    [JsonPropertyName("speakerId")] public Guid SpeakerId { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("sourcePath")] public string SourcePath { get; set; } = "";
    [JsonPropertyName("sourceUrl")] public string SourceUrl { get; set; } = "";
    [JsonPropertyName("httpStatus")] public int HttpStatus { get; set; }
}
