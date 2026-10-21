using DotNetLiguriaCore.Services.Newsletters;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterBoundedCollectionTests
{
    [Fact]
    public async Task NewsletterOverflowIsExplicitInsteadOfSilentlyHidingRecords()
    {
        var fixture = new NewsletterServiceFixture();
        for (var index = 0; index < 500; index++)
        {
            var item = new NewsletterDocument { Id = Guid.NewGuid() };
            fixture.Store.Newsletters[item.Id] = item;
        }
        var exception = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.ListAsync(CancellationToken.None));
        Assert.Equal(409, exception.StatusCode);
        Assert.Equal("newsletter_collection_limit_exceeded", exception.Code);
    }

    [Fact]
    public async Task TemplateOverflowIsExplicitInsteadOfSilentlyHidingRecords()
    {
        var fixture = new NewsletterServiceFixture();
        for (var index = 0; index < 501; index++)
        {
            var item = new NewsletterTemplateDocument { Id = Guid.NewGuid() };
            fixture.Store.Templates[item.Id] = item;
        }
        await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.ListTemplatesAsync(CancellationToken.None));
    }

    [Fact]
    public async Task HistoryAndDetailsRejectOverflow()
    {
        var fixture = new NewsletterServiceFixture();
        for (var index = 0; index < 200; index++)
        {
            var attempt = new NewsletterAttemptDocument { Id = Guid.NewGuid(), NewsletterId = fixture.NewsletterId };
            fixture.Store.Attempts[attempt.Id] = attempt;
        }
        await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.HistoryAsync(fixture.NewsletterId, CancellationToken.None));
        await Assert.ThrowsAsync<NewsletterServiceException>(() =>
            fixture.Service.GetAsync(fixture.NewsletterId, CancellationToken.None));
    }

    [Fact]
    public void PersonalExportRejects1001RecordsAndAccepts1000()
    {
        var records = Enumerable.Range(0, 1001).Select(_ => new BsonDocument
        {
            ["kind"] = "newsletter", ["document"] = new BsonDocument()
        }).ToArray();
        Assert.Equal(1000, MongoNewsletterStore.PrepareAccountExport(records.Take(1000), "issuer", "operator").Count);
        var exception = Assert.Throws<NewsletterServiceException>(() =>
            MongoNewsletterStore.PrepareAccountExport(records, "issuer", "operator"));
        Assert.Equal("newsletter_export_limit_exceeded", exception.Code);
    }
}
