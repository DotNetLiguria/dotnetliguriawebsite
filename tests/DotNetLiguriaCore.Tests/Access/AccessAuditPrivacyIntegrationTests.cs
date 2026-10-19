using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class AccessAuditPrivacyIntegrationTests
{
    [Fact]
    public async Task AccountExportIncludesAccessAuditAndErasureRemovesActorOrTargetRows()
    {
        var options = PrivacyCoordinatorTests.Settings();
        var account = new AccountReference(options.Issuer, "subject");
        var identities = new FakeIdentityAccountAdmin();
        identities.Accounts[account.Subject] = new IdentityAccount
        {
            Id = account.Subject, Enabled = true
        };
        var audit = new FakeAccessAuditStore
        {
            ExportDocuments =
            [
                new BsonDocument
                {
                    { "kind", "access-permission-audit" },
                    { "document", new BsonDocument { { "Action", "grant" }, { "Permission", "events.read" } } }
                }
            ]
        };
        audit.Entries.Add(new("audit-id", new DateTimeOffset(2026, 8, 9, 12, 0, 0, TimeSpan.Zero), "grant", "events.read",
            account.Issuer, account.Subject, account.Issuer, "another-subject", "verified", "correlation"));
        var coordinator = new PrivacyCoordinator(new(), new MemoryErasureJournal(), new FakeAccountPrivacyStore(),
            identities, new FakePrivacySnapshotStore(), Options.Create(options), accessAudit: audit);

        var export = await coordinator.ExportAsync(account, CancellationToken.None);
        var exportJson = System.Text.Json.JsonSerializer.Serialize(export);
        Assert.Equal(account, audit.ExportedAccount);
        Assert.Contains("access-permission-audit", exportJson);
        Assert.Contains("events.read", exportJson);

        await coordinator.EraseAsync(account, CancellationToken.None);

        Assert.Equal(account, audit.ErasedAccount);
        Assert.Empty(audit.Entries);
    }
}
