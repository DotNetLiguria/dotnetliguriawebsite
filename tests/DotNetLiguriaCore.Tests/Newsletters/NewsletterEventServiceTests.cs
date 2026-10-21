using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterEventServiceTests
{
    [Theory]
    [InlineData("StartTime")]
    [InlineData("EndTime")]
    [InlineData("Talks")]
    [InlineData("LocationName")]
    [InlineData("LocationAddress")]
    [InlineData("MapUrl")]
    [InlineData("Url")]
    public async Task IncompleteEventsCannotGenerateOrPreviewAnnouncements(string missing)
    {
        var fixture = new NewsletterServiceFixture();
        var eventId = Guid.NewGuid();
        var templateId = Guid.NewGuid();
        var projection = CompleteProjection(eventId);
        if (missing == "Talks") projection.Talks.Clear();
        else typeof(NewsletterEventProjection).GetProperty(missing)!.SetValue(projection, null);
        fixture.Events.Events[eventId] = projection;
        fixture.Store.Newsletters[fixture.NewsletterId].Kind = "event";
        fixture.Store.Newsletters[fixture.NewsletterId].EventId = eventId;
        fixture.Store.Templates[templateId] = new()
        {
            Id = templateId, Kind = "event", Subject = "{{event.title}}", Markdown = "{{event.talksMarkdown}}"
        };
        var generated = await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.GenerateAsync(
            fixture.NewsletterId, new(1, eventId, templateId), fixture.Principal, CancellationToken.None));
        Assert.Equal("event_public_details_incomplete", generated.Code);
        var previewed = await Assert.ThrowsAsync<NewsletterServiceException>(() => fixture.Service.PreviewTemplateAsync(
            templateId, new(1, eventId), CancellationToken.None));
        Assert.Equal("event_public_details_incomplete", previewed.Code);
        Assert.Equal("Subject", fixture.Store.Newsletters[fixture.NewsletterId].Subject);
    }

    [Fact]
    public async Task GenerationUsesUnescapedSubjectAndEscapedOnePassMarkdown()
    {
        var fixture = new NewsletterServiceFixture();
        var eventId = Guid.NewGuid();
        var templateId = Guid.NewGuid();
        var projection = CompleteProjection(eventId);
        projection.Title = "C# *deep dive*";
        fixture.Events.Events[eventId] = projection;
        fixture.Store.Newsletters[fixture.NewsletterId].Kind = "event";
        fixture.Store.Newsletters[fixture.NewsletterId].EventId = eventId;
        fixture.Store.Templates[templateId] = new()
        {
            Id = templateId, Kind = "event", Subject = "{{event.title}}", Markdown = "{{event.title}}"
        };
        var result = await fixture.Service.GenerateAsync(fixture.NewsletterId, new(1, eventId, templateId),
            fixture.Principal, CancellationToken.None);
        Assert.Equal("C# *deep dive*", result.Subject);
        Assert.Contains(@"\*deep dive\*", result.Markdown);
        Assert.Equal(2, fixture.Store.Newsletters[fixture.NewsletterId].Version);
        Assert.Null(fixture.Store.Newsletters[fixture.NewsletterId].TestSnapshotId);
    }

    private static NewsletterEventProjection CompleteProjection(Guid id) => new()
    {
        Id = id.ToString(), Title = "Title", Date = new DateOnly(2026, 10, 22), TimeZone = "Europe/Rome",
        StartTime = "10:00", EndTime = "11:00", LocationName = "Venue", LocationAddress = "Address",
        MapUrl = "https://example.test/map", Url = "https://example.test/workshop/" + id,
        Talks = [new NewsletterTalkProjection { Title = "Talk" }]
    };
}
