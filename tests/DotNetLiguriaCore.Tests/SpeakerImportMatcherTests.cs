using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class SpeakerImportMatcherTests
{
    [Fact]
    public void FindCollisions_matches_normalized_full_name_when_sessionize_id_is_new()
    {
        var existing = new WorkshopSpeaker
        {
            WorkshopSpeakerId = Guid.NewGuid(),
            Name = "José García"
        };
        var imported = new WorkshopSpeaker
        {
            SessionizeId = "sessionize-1",
            Name = "Jose   Garcia"
        };

        var collision = Assert.Single(SpeakerImportMatcher.FindCollisions([existing], [imported]));

        Assert.Equal("sessionize-1", collision.SessionizeId);
        Assert.Equal(existing.WorkshopSpeakerId, collision.ExistingSpeakerId);
    }

    [Fact]
    public void FindCollisions_does_not_ask_again_for_a_matching_sessionize_speaker()
    {
        var existing = new WorkshopSpeaker
        {
            WorkshopSpeakerId = Guid.NewGuid(),
            SessionizeId = "sessionize-1",
            Name = "Ada Lovelace"
        };
        var imported = new WorkshopSpeaker
        {
            SessionizeId = "sessionize-1",
            Name = "Ada Byron Lovelace"
        };

        Assert.Empty(SpeakerImportMatcher.FindCollisions([existing], [imported]));
    }
}
