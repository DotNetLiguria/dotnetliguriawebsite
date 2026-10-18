using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class EditorInputTests
{
    [Theory]
    [InlineData("https://example.test/path", true)]
    [InlineData("http://example.test/path", true)]
    [InlineData("/workshops/historical.png", true)]
    [InlineData("//example.test/path", false)]
    [InlineData("/\\example.test/path", false)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("data:text/html,example", false)]
    [InlineData("https://user:password@example.test", false)]
    [InlineData("https://example.test/\npath", false)]
    public void UrlsRejectActiveSchemesAndAmbiguousOrigins(string url, bool expected) =>
        Assert.Equal(expected, EditorInputFilter.IsSafeUrl(url, allowLocal: true));

    [Fact]
    public void EditorCannotOverwriteStorageOrIntegrationState()
    {
        var id = Guid.NewGuid();
        var creation = new DateTime(2025, 1, 1);
        var target = new Workshop
        {
            WorkshopId = id, CreationDate = creation, FolderName = "original",
            EventbriteEventId = "server-event", EventbriteLastError = "server-state",
            ExternalRegistrationLink = "https://eventbrite.example.test/server",
        };
        WorkshopEditorInput.Apply(target, new Workshop
        {
            WorkshopId = Guid.NewGuid(), CreationDate = DateTime.MaxValue, FolderName = "../escape",
            EventbriteEventId = "forged", EventbriteLastError = "forged", Title = "Edited", EventbriteTicketCapacity = 20,
            ExternalRegistrationLink = "https://example.test/forged",
        });
        Assert.Equal(id, target.WorkshopId);
        Assert.Equal(creation, target.CreationDate);
        Assert.Equal("original", target.FolderName);
        Assert.Equal("server-event", target.EventbriteEventId);
        Assert.Equal("server-state", target.EventbriteLastError);
        Assert.Equal("https://eventbrite.example.test/server", target.ExternalRegistrationLink);
        Assert.Equal("Edited", target.Title);
        Assert.Equal(20, target.EventbriteTicketCapacity);
        var created = new Workshop();
        WorkshopEditorInput.Apply(created, target);
        Assert.Null(created.EventbriteEventId);
        Assert.Null(created.FolderName);
        Assert.Null(created.CreationDate);
    }

    [Fact]
    public void ExactInputLimitsAreAcceptedAndExcessIsRejected()
    {
        var workshop = new Workshop { Title = new string('a', 200), Talks = Enumerable.Range(0, 200)
            .Select(_ => new WorkshopTalk()).ToList() };
        var errors = new Dictionary<string, string[]>();
        EditorInputFilter.Validate(workshop, errors);
        Assert.Empty(errors);
        workshop.Title += "a";
        workshop.Talks.Add(new WorkshopTalk());
        workshop.BookingServiceUrl = "javascript:alert(1)";
        EditorInputFilter.Validate(workshop, errors);
        Assert.Contains("title", errors.Keys);
        Assert.Contains("talks", errors.Keys);
        Assert.Contains("bookingServiceUrl", errors.Keys);
    }
}
