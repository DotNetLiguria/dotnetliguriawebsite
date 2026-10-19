using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Access;

public sealed class MongoAccessAuditStore : IAccessAuditStore
{
    public const string CollectionName = "AccessPermissionAudit";
    private readonly IMongoCollection<BsonDocument> _collection;

    public MongoAccessAuditStore(IOptions<DotNetLiguriaDatabaseSettings> settings)
    {
        if (string.IsNullOrWhiteSpace(settings.Value.ConnectionString) ||
            string.IsNullOrWhiteSpace(settings.Value.DatabaseName))
            throw new PrivacyBlockedException("access_audit_not_configured");
        _collection = new MongoClient(settings.Value.ConnectionString)
            .GetDatabase(settings.Value.DatabaseName)
            .GetCollection<BsonDocument>(CollectionName);
    }

    public async Task AppendAsync(AccessAuditEntry entry, CancellationToken cancellationToken)
    {
        try
        {
            await _collection.InsertOneAsync(ToDocument(entry), cancellationToken: cancellationToken);
        }
        catch (MongoException)
        {
            throw new PrivacyBlockedException("access_audit_unavailable");
        }
    }

    public async Task<IReadOnlyList<AccessAuditEntry>> RecentAsync(int limit, CancellationToken cancellationToken)
    {
        if (limit is < 1 or > 10101)
            throw new PrivacyBlockedException("invalid_access_audit_page", StatusCodes.Status400BadRequest);
        try
        {
            var documents = await _collection.Find(FilterDefinition<BsonDocument>.Empty)
                .SortByDescending(document => document["At"])
                .Limit(limit)
                .ToListAsync(cancellationToken);
            return documents.Select(ToEntry).ToArray();
        }
        catch (MongoException)
        {
            throw new PrivacyBlockedException("access_audit_unavailable");
        }
    }

    public async Task<IReadOnlyList<BsonDocument>> ExportAccountAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        try
        {
            var documents = await _collection.Find(AccountFilter(account)).Limit(1001).ToListAsync(cancellationToken);
            if (documents.Count > 1000)
                throw new PrivacyBlockedException("export_limit_exceeded");
            return documents.Select(document =>
            {
                var exported = document.DeepClone().AsBsonDocument;
                if (exported["ActorIssuer"].AsString != account.Issuer ||
                    exported["ActorSubject"].AsString != account.Subject)
                {
                    exported["ActorIssuer"] = "[redacted]";
                    exported["ActorSubject"] = "[redacted]";
                }
                if (exported["TargetIssuer"].AsString != account.Issuer ||
                    exported["TargetSubject"].AsString != account.Subject)
                {
                    exported["TargetIssuer"] = "[redacted]";
                    exported["TargetSubject"] = "[redacted]";
                }
                return new BsonDocument { { "kind", "access-permission-audit" }, { "document", exported } };
            }).ToArray();
        }
        catch (MongoException)
        {
            throw new PrivacyBlockedException("access_audit_unavailable");
        }
    }

    public async Task EraseAccountAsync(AccountReference account, CancellationToken cancellationToken)
    {
        try
        {
            await _collection.DeleteManyAsync(AccountFilter(account), cancellationToken);
            if (await _collection.Find(AccountFilter(account)).AnyAsync(cancellationToken))
                throw new PrivacyBlockedException("access_audit_erasure_not_verified");
        }
        catch (MongoException)
        {
            throw new PrivacyBlockedException("access_audit_unavailable");
        }
    }

    public static FilterDefinition<BsonDocument> AccountFilter(AccountReference account) =>
        new BsonDocument("$or", new BsonArray
        {
            new BsonDocument { { "ActorIssuer", account.Issuer }, { "ActorSubject", account.Subject } },
            new BsonDocument { { "TargetIssuer", account.Issuer }, { "TargetSubject", account.Subject } }
        });

    private static BsonDocument ToDocument(AccessAuditEntry entry) => new()
    {
        { "_id", entry.Id },
        { "At", entry.At.UtcDateTime },
        { "Action", entry.Action },
        { "Permission", entry.Permission },
        { "ActorIssuer", entry.ActorIssuer },
        { "ActorSubject", entry.ActorSubject },
        { "TargetIssuer", entry.TargetIssuer },
        { "TargetSubject", entry.TargetSubject },
        { "Outcome", entry.Outcome },
        { "CorrelationId", entry.CorrelationId }
    };

    private static AccessAuditEntry ToEntry(BsonDocument document)
    {
        try
        {
            return new(document["_id"].AsString,
                new DateTimeOffset(document["At"].ToUniversalTime()),
                document["Action"].AsString, document["Permission"].AsString,
                document["ActorIssuer"].AsString, document["ActorSubject"].AsString,
                document["TargetIssuer"].AsString, document["TargetSubject"].AsString,
                document["Outcome"].AsString, document["CorrelationId"].AsString);
        }
        catch (Exception exception) when (exception is KeyNotFoundException or InvalidCastException or FormatException)
        {
            throw new PrivacyBlockedException("access_audit_invalid_record");
        }
    }
}
