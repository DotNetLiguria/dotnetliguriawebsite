using System.Text.Json;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class PublicWorkshopProjectionTests
{
    [Fact]
    public void InternalIntegrationStateAndStoragePathsAreAbsent()
    {
        var workshop = new Workshop
        {
            Title = "Public event",
            EventbriteLastError = "synthetic-sensitive-error",
            EventbriteVenueId = "synthetic-internal-id",
            FolderName = "internal-folder",
            Talks = [new WorkshopTalk
            {
                Title = "Public talk", SessionizeId = "internal-session",
                Speakers = [new WorkshopTalkSpeaker { Name = "Editorial name", SessionizeId = "internal-speaker" }],
            }],
        };
        var json = JsonSerializer.Serialize(PublicWorkshopProjection.From(workshop), new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var document = JsonDocument.Parse(json);
        Assert.False(document.RootElement.TryGetProperty("eventbriteLastError", out _));
        Assert.False(document.RootElement.TryGetProperty("eventbriteVenueId", out _));
        Assert.False(document.RootElement.TryGetProperty("folderName", out _));
        Assert.DoesNotContain("synthetic-sensitive-error", json);
        Assert.DoesNotContain("sessionizeId", json);
        Assert.DoesNotContain("internal-session", json);
        Assert.Contains("Editorial name", json);
        Assert.Equal("Public event", document.RootElement.GetProperty("title").GetString());
    }

    [Fact]
    public void LegacyNullCollectionsRemainReadableWithoutExposingStorageModels()
    {
        var workshop = JsonSerializer.Deserialize<Workshop>(
            """{"Talks":null,"AgendaTracks":null,"AgendaItems":null,"Materials":null,"Photos":null}""");
        Assert.NotNull(workshop);
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(PublicWorkshopProjection.From(workshop),
            new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("talks").ValueKind);
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("materials").ValueKind);
    }
}
