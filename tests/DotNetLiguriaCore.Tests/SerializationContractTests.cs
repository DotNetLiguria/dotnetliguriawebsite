using System.Text.Json;
using DataMigration.Questionnaires;
using DotNetLiguriaCore.Model;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class SerializationContractTests
{
    public SerializationContractTests()
    {
        BsonCompatibility.Configure();
    }

    [Fact]
    public void WorkshopJsonRetainsPublicPropertyNamesAndDates()
    {
        var workshopId = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var eventDate = new DateTime(2024, 3, 15, 10, 0, 0, DateTimeKind.Utc);
        var workshop = new Workshop { WorkshopId = workshopId, EventDate = eventDate, In_homepage = true, FeedbackEnabled = true };
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var json = JsonSerializer.Serialize(workshop, options);
        using var document = JsonDocument.Parse(json);
        Assert.Equal(workshopId, document.RootElement.GetProperty("workshopId").GetGuid());
        Assert.True(document.RootElement.GetProperty("in_homepage").GetBoolean());
        Assert.True(document.RootElement.GetProperty("feedbackEnabled").GetBoolean());
        Assert.Equal(eventDate, JsonSerializer.Deserialize<Workshop>(json, options)!.EventDate);
    }

    [Fact]
    public void VenueAndEventRoomSnapshotsSerializeWithTheirPersistedFields()
    {
        var venueId = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var venue = new Venue
        {
            VenueId = venueId,
            Name = "Community Hall",
            Address = "1 Main Street",
            Coordinates = "44.4,8.9",
            GoogleMapsUrl = "https://maps.google.com/?q=Community+Hall",
            MaximumSpaces = 120
        };
        var venueDocument = venue.ToBsonDocument();
        Assert.Equal(venueId, venueDocument["_id"].AsBsonBinaryData.ToGuid(GuidRepresentation.CSharpLegacy));
        Assert.Equal("Community Hall", venueDocument["Name"].AsString);
        Assert.Equal("1 Main Street", venueDocument["Address"].AsString);

        var workshop = new Workshop
        {
            Location = new Location
            {
                Name = venue.Name,
                Address = venue.Address,
                Coordinates = venue.Coordinates,
                GoogleMapsUrl = venue.GoogleMapsUrl,
                MaximumSpaces = venue.MaximumSpaces,
                Rooms = ["Auditorium", "Room B"]
            }
        };
        var json = JsonSerializer.Serialize(workshop, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        using var document = JsonDocument.Parse(json);
        var location = document.RootElement.GetProperty("location");
        Assert.Equal("Community Hall", location.GetProperty("name").GetString());
        Assert.Equal("1 Main Street", location.GetProperty("address").GetString());
        Assert.Equal(new[] { "Auditorium", "Room B" }, location.GetProperty("rooms").EnumerateArray().Select(room => room.GetString()));
    }

    [Fact]
    public void MigrationFeedbackDocumentsKeepLegacyUuidEncodingAndLocalDateContract()
    {
        var feedbackId = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var utcDate = new DateTime(2024, 3, 15, 10, 0, 0, DateTimeKind.Utc);
        var feedback = new Feedback { FeedbackId = feedbackId, WorkshopId = feedbackId, WorkshopTrackId = feedbackId, CreatedDate = utcDate.ToLocalTime() };
        var document = feedback.ToBsonDocument();
        Assert.Equal(BsonBinarySubType.UuidLegacy, document["_id"].AsBsonBinaryData.SubType);
        Assert.Equal(feedbackId, document["_id"].AsBsonBinaryData.ToGuid(GuidRepresentation.CSharpLegacy));
        var copy = BsonSerializer.Deserialize<Feedback>(document);
        Assert.Equal(feedbackId, copy.FeedbackId);
        Assert.Equal(utcDate, copy.CreatedDate.ToUniversalTime());
        Assert.Equal(DateTimeKind.Local, copy.CreatedDate.Kind);
    }

    [Theory]
    [InlineData(GuidRepresentation.CSharpLegacy)]
    [InlineData(GuidRepresentation.Standard)]
    public void HistoricalWorkshopFixturesReadBothUuidSubtypes(GuidRepresentation representation)
    {
        var workshopId = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var fixture = new BsonDocument
        {
            { "_id", new BsonBinaryData(workshopId, representation) },
            { "Title", "Historical Workshop" },
            { "EventDate", new BsonDateTime(new DateTime(2024, 3, 15, 10, 0, 0, DateTimeKind.Utc)) }
        };
        var workshop = BsonSerializer.Deserialize<Workshop>(fixture);
        Assert.Equal(workshopId, workshop.WorkshopId);
        Assert.Equal("Historical Workshop", workshop.Title);
        Assert.Equal(DateTimeKind.Local, workshop.EventDate!.Value.Kind);
    }

    [Fact]
    public void WorkshopIdLookupMatchesBothUuidSubtypes()
    {
        var workshopId = Guid.Parse("00112233-4455-6677-8899-aabbccddeeff");
        var idFilter = BsonCompatibility.CreateGuidFilter("_id", workshopId);
        var idCandidates = idFilter["_id"]["$in"].AsBsonArray;

        Assert.Equal("_id", idFilter.GetElement(0).Name);
        Assert.Equal(2, idCandidates.Count);
        Assert.Contains(idCandidates, candidate =>
            candidate.AsBsonBinaryData.SubType == BsonBinarySubType.UuidLegacy &&
            candidate.AsBsonBinaryData.ToGuid(GuidRepresentation.CSharpLegacy) == workshopId);
        Assert.Contains(idCandidates, candidate =>
            candidate.AsBsonBinaryData.SubType == BsonBinarySubType.UuidStandard &&
            candidate.AsBsonBinaryData.ToGuid(GuidRepresentation.Standard) == workshopId);
    }
}