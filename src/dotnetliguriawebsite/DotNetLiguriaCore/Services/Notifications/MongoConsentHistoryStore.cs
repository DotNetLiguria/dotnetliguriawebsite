using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Notifications;

public sealed class MongoConsentHistoryStore(IOptions<DotNetLiguriaDatabaseSettings> settings) : IConsentHistoryStore
{
    public const string CollectionName = "ConsentHistory";
    private readonly IMongoCollection<BsonDocument> _collection = new MongoClient(settings.Value.ConnectionString)
        .GetDatabase(settings.Value.DatabaseName).GetCollection<BsonDocument>(CollectionName);

    public async Task AppendAsync(ConsentHistoryEntry entry, CancellationToken cancellationToken) =>
        await _collection.InsertOneAsync(new BsonDocument
        {
            { "_id", entry.Id }, { "AccountIssuer", entry.AccountIssuer }, { "AccountSubject", entry.AccountSubject },
            { "Purpose", entry.Purpose }, { "Version", entry.Version },
            { "OccurredAt", new BsonDateTime(entry.OccurredAt.UtcDateTime) },
            { "Action", entry.Action }, { "Status", entry.Status }
        }, cancellationToken: cancellationToken);

    public async Task SetStatusAsync(ConsentHistoryEntry entry, string status, CancellationToken cancellationToken)
    {
        var filter = AccountFilter(new(entry.AccountIssuer, entry.AccountSubject));
        filter.Add("_id", entry.Id);
        filter.Add("Status", "pending");
        var result = await _collection.UpdateOneAsync(filter,
            new BsonDocument("$set", new BsonDocument("Status", status)), cancellationToken: cancellationToken);
        if (result.MatchedCount != 1)
            throw new PrivacyBlockedException("consent_history_update_not_verified");
    }

    public async Task<IReadOnlyList<ConsentHistoryEntry>> PendingAsync(AccountReference account, string purpose, CancellationToken cancellationToken)
    {
        var filter = AccountFilter(account);
        filter.Add("Purpose", purpose);
        filter.Add("Status", "pending");
        var entries = await _collection.Find(filter).Limit(101).ToListAsync(cancellationToken);
        if (entries.Count > 100) throw new PrivacyBlockedException("consent_history_recovery_limit");
        return entries.Select(Read).ToArray();
    }

    public async Task<IReadOnlyList<ConsentHistoryEntry>> ReadAsync(AccountReference account, int offset, int limit, CancellationToken cancellationToken) =>
        (await _collection.Find(AccountFilter(account)).Sort(new BsonDocument { { "OccurredAt", -1 }, { "_id", -1 } })
            .Skip(offset).Limit(limit).ToListAsync(cancellationToken)).Select(Read).ToArray();

    public static BsonDocument AccountFilter(AccountReference account) => new()
    {
        { "AccountIssuer", account.Issuer }, { "AccountSubject", account.Subject }
    };

    private static ConsentHistoryEntry Read(BsonDocument document) => new(
        document["_id"].AsString, document["AccountIssuer"].AsString, document["AccountSubject"].AsString,
        document["Purpose"].AsString, document["Version"].AsString,
        new DateTimeOffset(document["OccurredAt"].ToUniversalTime()), document["Action"].AsString, document["Status"].AsString);
}
