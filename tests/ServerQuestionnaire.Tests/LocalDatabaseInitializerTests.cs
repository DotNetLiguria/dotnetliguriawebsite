using BlazorQuestionarioServer.Data;
using Xunit;

namespace ServerQuestionnaire.Tests;

public class LocalDatabaseInitializerTests
{
    [Theory]
    [InlineData("localhost,14330")]
    [InlineData("tcp:127.0.0.1,14330")]
    [InlineData("[::1],14330")]
    public void OnlyTheDesignatedLocalSqlDatabaseIsAccepted(string server)
    {
        LocalDatabaseInitializer.ValidateTarget($"Server={server};Database=DotNetLiguriaAspireQuestionnaire");
    }

    [Theory]
    [InlineData("Server=production,1433;Database=DotNetLiguriaAspireQuestionnaire")]
    [InlineData("Server=localhost,1433;Database=Production")]
    [InlineData("Server=localhost;Database=DotNetLiguriaAspireQuestionnaire")]
    [InlineData("Server=localhost,0;Database=DotNetLiguriaAspireQuestionnaire")]
    [InlineData("Server=localhost,1433;Database=DotNetLiguriaAspireQuestionnaire;AttachDbFilename=production.mdf")]
    public void NonLocalOrAmbiguousTargetsAreRejected(string connection)
    {
        Assert.Throws<InvalidOperationException>(() => LocalDatabaseInitializer.ValidateTarget(connection));
    }

    [Fact]
    public void SampleGraphIsDeterministicAndContainsSpeakerRelationships()
    {
        var workshop = LocalDatabaseInitializer.CreateSampleWorkshop();
        Assert.Equal(workshop.WorkshopId, LocalDatabaseInitializer.CreateSampleWorkshop().WorkshopId);
        Assert.True(workshop.Published);
        var track = Assert.Single(workshop.WorkshopTracks);
        Assert.Same(workshop, track.Workshop);
        Assert.Equal(workshop.WorkshopId, track.WorkshopId);
        var link = Assert.Single(track.ListaWorkshopTrackWorkshopSpeaker);
        Assert.Equal(track.WorkshopTrackId, link.WorkshopTrackWorkshopTrackId);
        Assert.Equal(link.WorkshopSpeakerWorkshopSpeakerId, link.WorkshopSpeakerWorkshopSpeaker.WorkshopSpeakerId);
    }
}
