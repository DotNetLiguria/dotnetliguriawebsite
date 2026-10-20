using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoAsset
{
    [BsonId]
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string OwnerKey { get; init; }
    public string? AccountIssuer { get; init; }
    public string? AccountSubject { get; init; }
    public required string SmallHash { get; init; }
    public required string LargeHash { get; init; }
}
