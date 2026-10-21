using DotNetLiguriaCore.Services.Newsletters;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterPrivacyExportTests
{
    [Fact]
    public void AuthorExportRedactsOtherOperatorsAndTestRecipientWithoutMutatingStoredData()
    {
        var thirdParty = Attempt("another-user", "private@example.test");
        var own = Attempt("operator", "mine@example.test");
        var result = MongoNewsletterStore.PrepareAccountExport([thirdParty, own], "issuer", "operator");
        var redacted = result[0]["document"].AsBsonDocument;
        Assert.False(redacted.Contains("Recipient"));
        Assert.False(redacted.Contains("ActorIssuer"));
        Assert.False(redacted.Contains("ActorSubject"));
        Assert.False(redacted.Contains("ReconciliationReason"));
        Assert.Equal("mine@example.test", result[1]["document"]["Recipient"]);
        Assert.Equal("private@example.test", thirdParty["document"]["Recipient"]);
        Assert.Equal("accepted", redacted["Status"]);
    }

    [Theory]
    [InlineData("newsletter")]
    [InlineData("newsletter-confirmation")]
    public void ExportNeverIncludesSingleUseConfirmationTokens(string kind)
    {
        var record = new BsonDocument
        {
            ["kind"] = kind,
            ["document"] = new BsonDocument
            {
                ["_id"] = "secret-token", ["ConfirmationId"] = "secret-token",
                ["Operator"] = "issuer|other", ["ConfirmationOperator"] = "issuer|other"
            }
        };
        var document = Assert.Single(MongoNewsletterStore.PrepareAccountExport([record], "issuer", "operator"))
            ["document"].AsBsonDocument;
        Assert.False(document.Contains("ConfirmationId"));
        Assert.False(document.Contains("Operator"));
        Assert.False(document.Contains("ConfirmationOperator"));
        if (kind == "newsletter-confirmation") Assert.False(document.Contains("_id"));
    }

    private static BsonDocument Attempt(string subject, string recipient) => new()
    {
        ["kind"] = "newsletter-attempt",
        ["document"] = new BsonDocument
        {
            ["ActorIssuer"] = "issuer", ["ActorSubject"] = subject, ["Recipient"] = recipient,
            ["ReconciledByIssuer"] = "issuer", ["ReconciledBySubject"] = subject,
            ["ReconciliationReason"] = "Private relay mailbox evidence", ["Status"] = "accepted"
        }
    };
}
