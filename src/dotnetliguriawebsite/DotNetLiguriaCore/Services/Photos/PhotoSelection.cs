using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoSelection
{
    [BsonId]
    public required string Key { get; init; }
    public string Version { get; init; } = Guid.NewGuid().ToString("N");
    public required string Source { get; init; }
    public Guid? AssetId { get; init; }
    public string? LegacyUrl { get; init; }
}
