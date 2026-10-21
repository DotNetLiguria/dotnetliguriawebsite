using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterRequestValidationTests
{
    [Fact]
    public async Task NullDraftStringsAreExplicitBadRequests()
    {
        var fixture = new NewsletterServiceFixture();
        foreach (var request in new[]
        {
            new NewsletterCreateRequest("generic", null!, "Subject", "Body", null, null),
            new NewsletterCreateRequest("generic", "Title", null!, "Body", null, null),
            new NewsletterCreateRequest("generic", "Title", "Subject", null!, null, null)
        })
        {
            var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
                fixture.Service.CreateAsync(request, fixture.Principal, CancellationToken.None));
            Assert.Equal(400, error.StatusCode);
        }
        foreach (var request in new[]
        {
            new NewsletterUpdateRequest(1, null!, "Subject", "Body"),
            new NewsletterUpdateRequest(1, "Title", null!, "Body"),
            new NewsletterUpdateRequest(1, "Title", "Subject", null!)
        })
        {
            var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
                fixture.Service.UpdateAsync(fixture.NewsletterId, request, fixture.Principal, CancellationToken.None));
            Assert.Equal(400, error.StatusCode);
        }
    }

    [Fact]
    public async Task NullTemplateStringsAreExplicitBadRequests()
    {
        var fixture = new NewsletterServiceFixture();
        var id = Guid.NewGuid();
        fixture.Store.Templates[id] = new() { Id = id, Name = "Name", Subject = "Subject", Markdown = "Body" };
        foreach (var request in new[]
        {
            new NewsletterTemplateCreateRequest("generic", null!, "Subject", "Body"),
            new NewsletterTemplateCreateRequest("generic", "Name", null!, "Body"),
            new NewsletterTemplateCreateRequest("generic", "Name", "Subject", null!)
        })
        {
            var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
                fixture.Service.CreateTemplateAsync(request, fixture.Principal, CancellationToken.None));
            Assert.Equal(400, error.StatusCode);
        }
        foreach (var request in new[]
        {
            new NewsletterTemplateUpdateRequest(1, null!, "Subject", "Body"),
            new NewsletterTemplateUpdateRequest(1, "Name", null!, "Body"),
            new NewsletterTemplateUpdateRequest(1, "Name", "Subject", null!)
        })
        {
            var error = await Assert.ThrowsAsync<NewsletterServiceException>(() =>
                fixture.Service.UpdateTemplateAsync(id, request, fixture.Principal, CancellationToken.None));
            Assert.Equal(400, error.StatusCode);
        }
    }

    [Fact]
    public async Task NullRecipientReasonAndConfirmationAreExplicitBadRequests()
    {
        var fixture = new NewsletterServiceFixture();
        var operations = new Func<Task>[]
        {
            async () => await fixture.Service.TestAsync(fixture.NewsletterId,
                new(1, fixture.SnapshotId, null!), fixture.Principal, CancellationToken.None),
            async () => await fixture.Service.EmlAsync(fixture.NewsletterId, fixture.SnapshotId, null!, CancellationToken.None),
            async () => await fixture.Service.SendAsync(fixture.NewsletterId,
                new(1, fixture.SnapshotId, null!), fixture.Principal, CancellationToken.None),
            async () => await fixture.Service.ReconcileAsync(fixture.NewsletterId,
                new(Guid.NewGuid(), "accepted", null!), fixture.Principal, CancellationToken.None)
        };
        foreach (var operation in operations)
        {
            var error = await Assert.ThrowsAsync<NewsletterServiceException>(operation);
            Assert.Equal(400, error.StatusCode);
        }
    }
}
