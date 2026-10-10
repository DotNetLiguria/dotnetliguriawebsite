using MongoDB.Bson;
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

    public static BsonDocument CreateGuidFilter(string fieldName, Guid id) =>
        new(fieldName, new BsonDocument("$in", new BsonArray
        {
            new BsonBinaryData(id, GuidRepresentation.CSharpLegacy),
            new BsonBinaryData(id, GuidRepresentation.Standard)
        }));
}