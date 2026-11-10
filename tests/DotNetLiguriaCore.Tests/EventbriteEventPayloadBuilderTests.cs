using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class EventbriteEventPayloadBuilderTests
{
    [Fact]
    public void Image_sync_state_is_not_exposed_in_workshop_json()
    {
        var workshop = new Workshop
        {
            EventbriteLogoId = "logo-4",
            EventbriteImageSha256 = "image-hash",
        };

        var json = System.Text.Json.JsonSerializer.Serialize(
            workshop,
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));

        Assert.DoesNotContain("eventbriteLogoId", json);
        Assert.DoesNotContain("eventbriteImageSha256", json);
    }

    [Fact]
    public void EventAndVenuePayloads_include_uploaded_logo_and_venue_coordinates()
    {
        var workshop = new Workshop
        {
            Title = "Liguria .NET",
            Description = "A community event",
            EventbriteLogoId = "logo-4",
            Location = new Location
            {
                Name = "Conference Hall",
                Address = "Via Roma 1, Genova",
                Coordinates = "44.4056, 8.9463",
            },
        };
        var options = new EventbriteOptions
        {
            OrganizerId = "organizer-2",
            CountryCode = "IT",
            TimeZoneId = "Europe/Rome",
            Currency = "EUR",
        };

        var eventPayload = EventbriteEventPayloadBuilder.BuildEvent(
            workshop, "venue-3", DateTimeOffset.Parse("2026-11-10T08:00:00Z"),
            DateTimeOffset.Parse("2026-11-10T16:00:00Z"), options);
        var venuePayload = EventbriteEventPayloadBuilder.BuildVenue(workshop, options);

        Assert.Equal("logo-4", eventPayload["logo_id"]?.GetValue<string>());
        Assert.Equal("venue-3", eventPayload["venue_id"]?.GetValue<string>());
        var address = venuePayload["address"]!;
        Assert.Null(venuePayload["latitude"]);
        Assert.Equal("44.4056", address["latitude"]?.GetValue<string>());
        Assert.Equal("8.9463", address["longitude"]?.GetValue<string>());
        Assert.Equal("Via Roma 1", address["address_1"]?.GetValue<string>());
        Assert.Equal("Genova", address["city"]?.GetValue<string>());
    }

    [Theory]
    [InlineData("Via Minzoni 2, 19100 La Spezia", "Via Minzoni 2", "La Spezia", "19100")]
    [InlineData("via Semeria, 16A - 16131 Genova - Italia", "via Semeria, 16A", "Genova", "16131")]
    [InlineData("Piazza della Vittoria 11/10, Genova (GE)", "Piazza della Vittoria 11/10", "Genova", null)]
    public void Venue_address_is_split_into_street_city_and_postal_code(string raw, string street, string city, string? postalCode)
    {
        var workshop = new Workshop { Location = new Location { Name = "Hall", Address = raw, Coordinates = "" } };

        var address = EventbriteEventPayloadBuilder.BuildVenue(workshop, new EventbriteOptions { CountryCode = "IT" })["address"]!;

        Assert.Equal(street, address["address_1"]?.GetValue<string>());
        Assert.Equal(city, address["city"]?.GetValue<string>());
        Assert.Equal(postalCode, address["postal_code"]?.GetValue<string>());
    }

    [Theory]
    [InlineData("Via del Porto 1")]
    [InlineData("Via del Porto 1, 16121")]
    public void Address_without_city_is_detected(string raw) =>
        Assert.False(EventbriteEventPayloadBuilder.HasCity(raw));

    [Fact]
    public void Structured_content_includes_notes_registration_link_and_agenda_safely()
    {
        var trackId = Guid.NewGuid();
        var workshop = new Workshop
        {
            Description = "Workshop & intro",
            AttendeeNotes = "<bring a laptop>",
            BookingServiceUrl = "https://example.test/book?a=1&b=2",
            AgendaTracks = [new WorkshopAgendaTrack { WorkshopAgendaTrackId = trackId, Name = "Main" }],
            AgendaItems =
            [
                new WorkshopAgendaItem
                {
                    TrackId = trackId,
                    Title = "<Opening>",
                    StartTime = new DateTime(2026, 11, 10, 9, 0, 0),
                    EndTime = new DateTime(2026, 11, 10, 10, 0, 0),
                }
            ],
        };

        var html = EventbriteEventPayloadBuilder.BuildStructuredContent(workshop)[0]
            ?["data"]?["body"]?["text"]?.GetValue<string>();

        Assert.Contains("Notes for participants", html, StringComparison.Ordinal);
        Assert.Contains("&lt;bring a laptop&gt;", html, StringComparison.Ordinal);
        Assert.Contains("https://example.test/book?a=1&amp;b=2", html, StringComparison.Ordinal);
        Assert.Contains("&lt;Opening&gt;", html, StringComparison.Ordinal);
    }
}
