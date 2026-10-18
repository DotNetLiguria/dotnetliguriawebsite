using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PersonalDataTests
{
    [Fact]
    public async Task SummaryUsesOnlyCallerIdentityAndSafeBoundedRecordMetadata()
    {
        var options = PrivacyCoordinatorTests.Settings();
        var account = new AccountReference(options.Issuer, "subject");
        var identities = new FakeIdentityAccountAdmin();
        identities.Accounts[account.Subject] = new IdentityAccount
        {
            Id = account.Subject, FirstName = "Synthetic", LastName = "User", Email = "synthetic@example.test",
            EmailVerified = true, Enabled = true, Attributes = new() { ["private_internal_attribute"] = ["hidden"] }
        };
        var store = new FakeAccountPrivacyStore
        {
            Documents = Enumerable.Range(0, 52).Select(index => new BsonDocument
            {
                { "kind", "response" }, { "document", new BsonDocument
                    {
                        { "_id", index.ToString("D3") }, { "SubmittedAt", new BsonDateTime(new DateTime(2026, 10, 18, 12, 0, 0, DateTimeKind.Utc)) },
                        { "QuestionnaireVersion", 2 }, { "ConsentGiven", true }, { "Answers", new BsonArray { "private answer" } }
                    }
                }
            }).ToArray()
        };
        var service = new PrivacyCoordinator(new(), new MemoryErasureJournal(), store, identities,
            new FakePrivacySnapshotStore(), Options.Create(options));
        var page = await service.DataAsync(account, 0, TestContext.Current.CancellationToken);
        Assert.Equal(account, store.ExportedAccount);
        Assert.Equal("Synthetic", page.Identity?.FirstName);
        Assert.Equal(50, page.Records.Count);
        Assert.True(page.HasMore);
        Assert.True(page.Records[0].ConsentGiven);
        Assert.Equal(2, page.Records[0].QuestionnaireVersion);
        Assert.Equal(TimeSpan.Zero, page.Records[0].SubmittedAt?.Offset);
        var json = System.Text.Json.JsonSerializer.Serialize(page);
        Assert.DoesNotContain("private_internal_attribute", json);
        Assert.DoesNotContain("private answer", json);
        var next = await service.DataAsync(account, 50, TestContext.Current.CancellationToken);
        Assert.Equal(2, next.Records.Count);
        Assert.False(next.HasMore);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.DataAsync(account, -1, TestContext.Current.CancellationToken));
    }
}
