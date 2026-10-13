using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WorkshopSpeakerReferenceMapperTests
{
    [Fact]
    public void Repoint_updates_duplicate_ids_without_changing_talk_snapshots()
    {
        var duplicateId = Guid.NewGuid();
        var canonicalId = Guid.NewGuid();
        var workshop = new Workshop
        {
            Talks =
            [
                new WorkshopTalk
                {
                    Title = "Historical talk",
                    Speakers = [new WorkshopTalkSpeaker
                    {
                        WorkshopSpeakerId = duplicateId,
                        Name = "Historical speaker name",
                        Biography = "Historical biography"
                    }]
                }
            ]
        };

        var changed = WorkshopSpeakerReferenceMapper.Repoint(workshop, new Dictionary<Guid, Guid>
        {
            [duplicateId] = canonicalId
        });

        var speaker = Assert.Single(Assert.Single(workshop.Talks!).Speakers);
        Assert.True(changed);
        Assert.Equal(canonicalId, speaker.WorkshopSpeakerId);
        Assert.Equal("Historical speaker name", speaker.Name);
        Assert.Equal("Historical biography", speaker.Biography);
    }
}
