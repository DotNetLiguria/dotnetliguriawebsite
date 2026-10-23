using System.Text.Json.Serialization;

namespace DataMigration;

public sealed class SpeakerAssetManifest
{
    [JsonPropertyName("verifiedAssets")]
    public List<VerifiedSpeakerAsset> VerifiedAssets { get; set; } = [];
    [JsonPropertyName("unavailableMedia")]
    public List<UnavailableSpeakerAsset> UnavailableMedia { get; set; } = [];
}
