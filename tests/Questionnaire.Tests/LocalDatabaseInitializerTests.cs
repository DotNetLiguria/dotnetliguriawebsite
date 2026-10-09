using BlazorAppTest.Server;
using DotNetLiguria.ServiceDefaults;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Questionnaire.Tests;

public class LocalDatabaseInitializerTests
{
    [Fact]
    public void InitializationIsDisabledByDefault()
    {
        Assert.False(LocalDevelopment.ShouldInitialize(new ConfigurationBuilder().Build(),
            new TestHostEnvironment { EnvironmentName = Environments.Production }));
    }

    [Theory]
    [InlineData("Production", "true")]
    [InlineData("Development", "false")]
    [InlineData("Development", null)]
    public void InitializationRejectsNonAspireOrProduction(string environment, string? aspire)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LocalDevelopment:Initialize"] = "true", ["DOTNET_LIGURIA_ASPIRE"] = aspire
        }).Build();
        Assert.Throws<InvalidOperationException>(() => LocalDevelopment.ShouldInitialize(configuration,
            new TestHostEnvironment { EnvironmentName = environment }));
    }

    [Fact]
    public void InitializationRequiresBothExplicitOptInAndDevelopment()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LocalDevelopment:Initialize"] = "true", ["DOTNET_LIGURIA_ASPIRE"] = "true"
        }).Build();
        Assert.True(LocalDevelopment.ShouldInitialize(configuration,
            new TestHostEnvironment { EnvironmentName = Environments.Development }));
    }

    [Fact]
    public void SqliteOnlyAcceptsTheDedicatedAbsoluteFile()
    {
        var directory = Path.Combine(Path.GetTempPath(), "aspire-data");
        LocalDatabaseInitializer.ValidateTarget($"Data Source={Path.Combine(directory, "questionnaire.db")}", directory);
        foreach (var source in new[] { "production.db", ":memory:", Path.Combine(directory, "..", "other.db") })
            Assert.Throws<InvalidOperationException>(() =>
                LocalDatabaseInitializer.ValidateTarget($"Data Source={source}", directory));
        Assert.Throws<InvalidOperationException>(() =>
            LocalDatabaseInitializer.ValidateTarget("Data Source=questionnaire.db", "relative"));
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
        Assert.True(track.Level > 0);
        var link = Assert.Single(track.WorkshopTrackWorkshopSpeaker);
        Assert.Equal(track.WorkshopTrackId, link.WorkshopTrackWorkshopTrackId);
        Assert.Equal(link.WorkshopSpeakerWorkshopSpeakerId, link.WorkshopSpeakerWorkshopSpeaker.WorkshopSpeakerId);
    }
}
