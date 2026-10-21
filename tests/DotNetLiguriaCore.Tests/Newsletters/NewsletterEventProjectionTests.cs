using DotNetLiguriaCore;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Newsletters;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterEventProjectionTests
{
    [Fact]
    public void ShippedConfigurationProvidesTheCanonicalPublicEventUrlWithoutEnablingProductionEmail()
    {
        var environment = new NewsletterTestEnvironment();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(environment.ContentRootPath).AddJsonFile("appsettings.json").Build();
        var services = new ServiceCollection();
        services.Configure<NewsletterOptions>(configuration.GetSection(NewsletterOptions.SectionName));
        using var provider = services.BuildServiceProvider();
        var projection = Assert.IsType<NewsletterEventProjection>(Source(provider).CreateProjection(Event()));
        Assert.StartsWith("https://dotnetliguria.net/workshop/", projection.Url);
        var options = provider.GetRequiredService<IOptionsMonitor<NewsletterOptions>>().CurrentValue;
        Assert.False(options.HasSmtpConfiguration);
        Assert.False(options.ProductionEnabled);
    }

    [Fact]
    public void ModernTalksWithoutAnAgendaRemainAvailableAndUseTheRealPublicRoute()
    {
        using var services = OptionsProvider();
        var source = Source(services);
        var workshop = Event();
        workshop.Slug = "not-the-route-identifier";
        workshop.Talks = [new WorkshopTalk { Title = "Modern talk", Speakers = [new() { Name = "Ada" }] }];

        var projection = Assert.IsType<NewsletterEventProjection>(source.CreateProjection(workshop));
        Assert.Equal($"https://events.example.test/workshop/{workshop.WorkshopId:D}", projection.Url);
        Assert.Equal("Modern talk", Assert.Single(projection.Talks).Title);
        Assert.Equal(["Ada"], projection.Talks[0].Speakers);
        Assert.Null(projection.StartTime);
        Assert.Null(projection.EndTime);
    }

    [Fact]
    public void AgendaOrdersTalksAndAdvertisesOnlyActualScheduleTimes()
    {
        using var services = OptionsProvider();
        var source = Source(services);
        var workshop = Event();
        var first = new WorkshopTalk { Title = "First" };
        var second = new WorkshopTalk { Title = "Second" };
        workshop.Talks = [second, first];
        workshop.AgendaItems =
        [
            new() { TalkId = second.WorkshopTalkId, StartTime = workshop.EventDate!.Value.AddHours(16), EndTime = workshop.EventDate.Value.AddHours(17) },
            new() { TalkId = first.WorkshopTalkId, StartTime = workshop.EventDate.Value.AddHours(14), EndTime = workshop.EventDate.Value.AddHours(15) }
        ];

        var projection = Assert.IsType<NewsletterEventProjection>(source.CreateProjection(workshop));
        Assert.Equal(["First", "Second"], projection.Talks.Select(talk => talk.Title));
        Assert.Equal("14:00", projection.StartTime);
        Assert.Equal("17:00", projection.EndTime);
        Assert.Equal("https://maps.example.test/location", projection.MapUrl);
    }

    [Fact]
    public void LegacySpeakerNamesAndLocationArePreserved()
    {
        using var services = OptionsProvider();
        var workshop = Event();
        workshop.Tracks = [new WorkshopTrack { Title = "Legacy", SpeakersName = "Ada, Linus" }];
        var projection = Assert.IsType<NewsletterEventProjection>(Source(services).CreateProjection(workshop));
        Assert.Equal(["Ada, Linus"], Assert.Single(projection.Talks).Speakers);
        Assert.Equal("Venue", projection.LocationName);
        Assert.Equal("Address", projection.LocationAddress);
    }

    [Theory]
    [InlineData(false, 21)]
    [InlineData(true, 19)]
    public void UnpublishedAndPastEventsAreNotEligible(bool published, int day)
    {
        using var services = OptionsProvider();
        var workshop = Event();
        workshop.Published = published;
        workshop.EventDate = new DateTime(2026, 10, day);
        Assert.Null(Source(services).CreateProjection(workshop));
    }

    [Fact]
    public void LocalTimeValidationUsesTheEventDateNotTheHistoricTimeCarrierDate()
    {
        using var services = OptionsProvider();
        var source = Source(services, new DateTimeOffset(2026, 3, 28, 12, 0, 0, TimeSpan.Zero));
        var workshop = Event();
        workshop.EventDate = new DateTime(2026, 3, 29);
        workshop.Tracks =
        [
            new WorkshopTrack
            {
                Title = "Invalid DST interval",
                StartTime = new DateTime(2000, 1, 1, 2, 30, 0),
                EndTime = new DateTime(2000, 1, 1, 3, 30, 0)
            }
        ];
        var projection = Assert.IsType<NewsletterEventProjection>(source.CreateProjection(workshop));
        Assert.Null(projection.StartTime);
        Assert.Null(projection.EndTime);
    }

    private static NewsletterEventSource Source(ServiceProvider services, DateTimeOffset? now = null) =>
        new(Options.Create(new DotNetLiguriaDatabaseSettings
        {
            ConnectionString = "mongodb://localhost:27017", DatabaseName = "never-connect",
            WorkshopCollectionName = "Workshop"
        }), new ConfigurationManager(),
            services.GetRequiredService<IOptionsMonitor<NewsletterOptions>>(),
            new FixedAuthorizationClock(now ?? new DateTimeOffset(2026, 10, 20, 10, 0, 0, TimeSpan.Zero)));

    private static ServiceProvider OptionsProvider()
    {
        var services = new ServiceCollection();
        services.Configure<NewsletterOptions>(options => options.PublicBaseUrl = "https://events.example.test");
        return services.BuildServiceProvider();
    }

    private static Workshop Event() => new()
    {
        WorkshopId = Guid.NewGuid(), Title = "Event", Published = true,
        EventDate = new DateTime(2026, 10, 21),
        Location = new Location { Name = "Venue", Address = "Address", GoogleMapsUrl = "https://maps.example.test/location" }
    };
}
