using System.Text.Json.Serialization;

namespace DataMigration;

public sealed class VerifiedSpeakerAsset
{
    [JsonPropertyName("speakerId")] public Guid SpeakerId { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("sourcePath")] public string SourcePath { get; set; } = "";
    [JsonPropertyName("sourceUrl")] public string SourceUrl { get; set; } = "";
    [JsonPropertyName("path")] public string Path { get; set; } = "";
    [JsonPropertyName("sha256")] public string Sha256 { get; set; } = "";
    [JsonPropertyName("bytes")] public long Bytes { get; set; }
}
