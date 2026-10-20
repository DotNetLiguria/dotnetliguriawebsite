using System.Text.Json;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class BoardAccountContractTests
{
    public BoardAccountContractTests() => BsonCompatibility.Configure();

    [Fact]
    public void MembershipAuditPersistsGroupAndCanStillReadLegacyDirectGrantRecords()
    {
        var entry = new AccessAuditEntry("audit-id", DateTimeOffset.Parse("2026-08-09T12:00:00Z"),
            "board-join", "", "issuer", "actor", "issuer", "target", "verified", "correlation",
            "33333333-3333-3333-3333-333333333333");
        var flags = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static;
        var toDocument = typeof(MongoAccessAuditStore).GetMethod("ToDocument", flags)!;
        var toEntry = typeof(MongoAccessAuditStore).GetMethod("ToEntry", flags)!;
        var document = Assert.IsType<BsonDocument>(toDocument.Invoke(null, [entry]));
        Assert.Equal(entry.GroupId, document["GroupId"].AsString);
        Assert.Equal(entry, Assert.IsType<AccessAuditEntry>(toEntry.Invoke(null, [document])));
        document.Remove("GroupId");
        document["Action"] = "grant";
        document["Permission"] = "events.read";
        var legacy = Assert.IsType<AccessAuditEntry>(toEntry.Invoke(null, [document]));
        Assert.Null(legacy.GroupId);
        Assert.Equal("events.read", legacy.Permission);
    }

    [Fact]
    public void OrdinaryJsonCannotForgeClearOrExposePrivateLinksAndBsonRetainsThem()
    {
        var board = JsonSerializer.Deserialize<Board>(
            """{"name":"Member","description":"Presidente","accountIssuer":"forged","accountSubject":"forged"}""",
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Null(board.AccountIssuer);
        Assert.Null(board.AccountSubject);
        board.AccountIssuer = AccessManagementServiceTests.Issuer;
        board.AccountSubject = "11111111-1111-1111-1111-111111111111";
        var json = JsonSerializer.Serialize(board);
        Assert.DoesNotContain("AccountIssuer", json);
        Assert.DoesNotContain("AccountSubject", json);
        var restored = BsonSerializer.Deserialize<Board>(board.ToBsonDocument());
        Assert.Equal(board.AccountIssuer, restored.AccountIssuer);
        Assert.Equal(board.AccountSubject, restored.AccountSubject);
        Assert.Equal("Presidente", restored.Description);
        var legacy = BsonSerializer.Deserialize<Board>(new BsonDocument { { "Name", "Legacy" } });
        Assert.Null(legacy.AccountIssuer);
        Assert.Null(legacy.AccountSubject);
    }

    [Fact]
    public void LinkRequiresAnExactPartialUniqueConstraintAndPrivacyUsesBothIdentityFields()
    {
        var index = new BsonDocument
        {
            { "key", new BsonDocument { { "AccountIssuer", 1 }, { "AccountSubject", 1 } } },
            { "unique", true },
            { "partialFilterExpression", new BsonDocument {
                { "AccountIssuer", new BsonDocument("$type", "string") },
                { "AccountSubject", new BsonDocument("$type", "string") } } }
        };
        Assert.True(BoardService.IsAccountLinkIndex(index));
        index["unique"] = false;
        Assert.False(BoardService.IsAccountLinkIndex(index));
        index["unique"] = true;
        index.Remove("partialFilterExpression");
        Assert.False(BoardService.IsAccountLinkIndex(index));
        var account = new AccountReference(AccessManagementServiceTests.Issuer, "subject");
        Assert.Equal(new BsonDocument { { "AccountIssuer", account.Issuer }, { "AccountSubject", account.Subject } },
            MongoAccountPrivacyStore.BoardAccountFilter(account));
        Assert.Contains("board.AccountIssuer", ErasureFieldInventory.DeletableFields);
        Assert.Contains("board.AccountSubject", ErasureFieldInventory.DeletableFields);
    }
}
