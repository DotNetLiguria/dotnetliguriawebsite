using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Notifications;

public sealed class MongoNotificationCampaignStore(IOptions<DotNetLiguriaDatabaseSettings> settings) : INotificationCampaignStore
{
    private readonly IMongoDatabase _database = new MongoClient(settings.Value.ConnectionString).GetDatabase(settings.Value.DatabaseName);
    private readonly string _workshopCollection = settings.Value.WorkshopCollectionName;

    public async Task<Guid[]> ResolveEventsAsync(NotificationCampaignRequest request, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var workshops = _database.GetCollection<Model.Workshop>(_workshopCollection);
        var filter = Builders<Model.Workshop>.Filter.Eq(item => item.Published, true) &
            Builders<Model.Workshop>.Filter.Gte(item => item.EventDate, now.UtcDateTime);
        if (request.Purpose == "monthly-upcoming-events")
            filter &= Builders<Model.Workshop>.Filter.Lt(item => item.EventDate, now.AddMonths(1).UtcDateTime);
        else
        {
            if (request.EventIds is null || request.EventIds.Length is < 1 or > 20 ||
                request.EventIds.Any(id => id == Guid.Empty) || request.EventIds.Distinct().Count() != request.EventIds.Length)
                throw new PrivacyBlockedException("invalid_campaign_events", 400);
            filter &= Builders<Model.Workshop>.Filter.In(item => item.WorkshopId, request.EventIds);
        }
        var ids = await workshops.Find(filter).Limit(101).Project(item => item.WorkshopId).ToListAsync(cancellationToken);
        if (ids.Count > 100 || ids.Count == 0 ||
            (request.Purpose == "event-announcements" && ids.Count != request.EventIds.Length))
            throw new PrivacyBlockedException("campaign_events_unavailable", 409);
        return ids.ToArray();
    }

    public Task SaveAsync(NotificationCampaign campaign, CancellationToken cancellationToken) =>
        Campaigns.ReplaceOneAsync(new BsonDocument("_id", campaign.Id), new BsonDocument
        {
            { "_id", campaign.Id }, { "Purpose", campaign.Purpose },
            { "EventIds", new BsonArray(campaign.EventIds.Select(id => id.ToString("D"))) },
            { "CreatedAt", campaign.CreatedAt.UtcDateTime }, { "ExpiresAt", campaign.ExpiresAt.UtcDateTime },
            { "RecipientCount", campaign.RecipientCount }, { "CreatedBy", campaign.CreatedBy }, { "Status", campaign.Status }
        }, new ReplaceOptions { IsUpsert = true }, cancellationToken);

    public async Task<NotificationCampaign?> GetAsync(string id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParseExact(id, "N", out _)) throw new PrivacyBlockedException("invalid_campaign_id", 400);
        var document = await Campaigns.Find(new BsonDocument("_id", id)).FirstOrDefaultAsync(cancellationToken);
        return document is null ? null : new NotificationCampaign(
            document["_id"].AsString, document["Purpose"].AsString,
            document["EventIds"].AsBsonArray.Select(value => Guid.Parse(value.AsString)).ToArray(),
            document["CreatedAt"].ToUniversalTime(), document["ExpiresAt"].ToUniversalTime(),
            document["RecipientCount"].AsInt32, document["CreatedBy"].AsString, document["Status"].AsString);
    }

    private IMongoCollection<BsonDocument> Campaigns => _database.GetCollection<BsonDocument>("NotificationCampaigns");
}
