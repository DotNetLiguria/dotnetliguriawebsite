using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace DotNetLiguriaCore.Model;

public sealed class LegacyCompatibleGuidSerializer : SerializerBase<Guid>
{
    public override Guid Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
    {
        var bsonType = context.Reader.GetCurrentBsonType();
        if (bsonType == BsonType.String)
            return Guid.Parse(context.Reader.ReadString());
        if (bsonType != BsonType.Binary)
            throw new FormatException($"Cannot deserialize {bsonType} as Guid.");

        var binary = context.Reader.ReadBinaryData();
        return binary.ToGuid(binary.SubType == BsonBinarySubType.UuidStandard
            ? GuidRepresentation.Standard
            : GuidRepresentation.CSharpLegacy);
    }

    public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, Guid value)
    {
        context.Writer.WriteBinaryData(new BsonBinaryData(value, GuidRepresentation.CSharpLegacy));
    }
}