using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WorkshopTalkImportMergerTests
{
    [Fact]
    public void Merge_overwrites_matching_imports_and_preserves_manual_and_unmatched_talks()
    {
        var existingId = Guid.NewGuid();
        var existingTalks = new[]
        {
            new WorkshopTalk { WorkshopTalkId = existingId, SessionizeId = "matching", Title = "Old title" },
            new WorkshopTalk { SessionizeId = "unmatched", Title = "Keep this" },
            new WorkshopTalk { Title = "Manual talk" }
        };
        var imported = new[]
        {
            new WorkshopTalk { SessionizeId = "matching", Title = "Imported title" },
            new WorkshopTalk { SessionizeId = "new", Title = "New imported talk" }
        };

        var result = WorkshopTalkImportMerger.Merge(existingTalks, imported);

        Assert.Equal(4, result.Count);
        Assert.Equal("Imported title", Assert.Single(result, talk => talk.SessionizeId == "matching").Title);
        Assert.Equal(existingId, Assert.Single(result, talk => talk.SessionizeId == "matching").WorkshopTalkId);
        Assert.Contains(result, talk => talk.SessionizeId == "unmatched" && talk.Title == "Keep this");
        Assert.Contains(result, talk => talk.SessionizeId is null && talk.Title == "Manual talk");
        Assert.Contains(result, talk => talk.SessionizeId == "new" && talk.Title == "New imported talk");
    }
}
