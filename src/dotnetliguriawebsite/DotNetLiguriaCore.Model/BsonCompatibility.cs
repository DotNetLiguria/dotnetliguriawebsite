using MongoDB.Bson.Serialization;

namespace DotNetLiguriaCore.Model;

public static class BsonCompatibility
{
    private static readonly Lazy<bool> _initialization = new(() =>
    {
        BsonSerializer.RegisterSerializer(new LegacyCompatibleGuidSerializer());
        return true;
    });

    public static void Configure()
    {
        _ = _initialization.Value;
    }
}