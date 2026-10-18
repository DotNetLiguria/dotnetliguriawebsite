using Microsoft.Extensions.Options;
using DotNetLiguriaCore.Services.Notifications;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class MongoAccountPrivacyStore(IOptions<DotNetLiguriaDatabaseSettings> settings, IOptions<PrivacyOptions> options)
    : IAccountPrivacyStore
{
    private readonly DotNetLiguriaDatabaseSettings _settings = settings.Value;
    private readonly PrivacyOptions _options = options.Value;
    private readonly IMongoDatabase _database = new MongoClient(settings.Value.ConnectionString).GetDatabase(settings.Value.DatabaseName);

    public async Task<IReadOnlyList<string>> InspectAsync(AccountReference account, CancellationToken cancellationToken)
    {
        var blockers = new List<string>();
        var known = new HashSet<string>(_options.AssessedNonAccountCollections, StringComparer.Ordinal)
        {
            _settings.QuestionnaireCollectionName, _settings.QuestionnaireResponseCollectionName,
            "NotificationCampaigns", MongoConsentHistoryStore.CollectionName
        };
        using var names = await _database.ListCollectionNamesAsync(cancellationToken: cancellationToken);
        foreach (var name in await names.ToListAsync(cancellationToken))
            if (!name.StartsWith("system.", StringComparison.Ordinal) && !known.Contains(name))
                blockers.Add("unassessed_collection");

        // Legacy identity cannot be attributed using an email lookup. Require an approved transition instead.
        var legacyResponse = new BsonDocument("$or", new BsonArray
        {
            new BsonDocument("UniqueEmailKey", new BsonDocument("$type", "string")),
            new BsonDocument("Respondent", new BsonDocument("$type", "object"))
        });
        if (await Responses.Find(legacyResponse).AnyAsync(cancellationToken))
            blockers.Add("legacy_respondent_inventory_required");
        var brokenReference = new BsonDocument("$or", new BsonArray
        {
            new BsonDocument
            {
                { "AccountSubject", new BsonDocument("$type", "string") },
                { "AccountIssuer", new BsonDocument("$ne", _options.Issuer) }
            },
            new BsonDocument
            {
                { "AccountIssuer", _options.Issuer },
                { "$or", new BsonArray
                    {
                        new BsonDocument("AccountSubject", BsonNull.Value),
                        new BsonDocument("AccountSubject", "")
                    }
                }
            },
            new BsonDocument
            {
                { "UniqueAccountKey", new BsonDocument("$type", "string") },
                { "$or", new BsonArray
                    {
                        new BsonDocument("AccountSubject", new BsonDocument("$not", new BsonDocument("$type", "string"))),
                        new BsonDocument("AccountIssuer", new BsonDocument("$ne", _options.Issuer))
                    }
                }
            }
        });
        if (await Responses.Find(brokenReference).AnyAsync(cancellationToken))
            blockers.Add("unattributable_account_reference");
        var invalidConsentAccount = new BsonDocument("$or", new BsonArray
        {
            new BsonDocument("AccountIssuer", new BsonDocument("$ne", _options.Issuer)),
            new BsonDocument("AccountSubject", new BsonDocument("$not", new BsonDocument("$type", "string"))),
            new BsonDocument("AccountSubject", "")
        });
        if (await Consents.Find(invalidConsentAccount).AnyAsync(cancellationToken))
            blockers.Add("unattributable_consent_reference");
        using var authors = await Questionnaires.FindAsync(
            new BsonDocument("CreatedBy", new BsonDocument("$type", "string")), cancellationToken: cancellationToken);
        while (await authors.MoveNextAsync(cancellationToken))
            foreach (var document in authors.Current)
            {
                var actor = document["CreatedBy"].AsString;
                if (actor.Length > 0 && actor != "deleted user" && !actor.StartsWith(_options.Issuer + "|", StringComparison.Ordinal))
                    blockers.Add("legacy_author_inventory_required");
            }
        return blockers.Distinct(StringComparer.Ordinal).ToArray();
    }

    public async Task<IReadOnlyList<BsonDocument>> ExportAsync(AccountReference account, CancellationToken cancellationToken)
    {
        var result = new List<BsonDocument>();
        var responses = await Responses.Find(ResponseFilter(account)).Limit(1001).ToListAsync(cancellationToken);
        result.AddRange(responses.Select(document => new BsonDocument { { "kind", "response" }, { "document", document } }));
        var questionnaires = await Questionnaires.Find(new BsonDocument("CreatedBy", account.ActorKey))
            .Limit(1001).ToListAsync(cancellationToken);
        result.AddRange(questionnaires.Select(document => new BsonDocument { { "kind", "authored-questionnaire" }, { "document", document } }));
        var campaigns = await _database.GetCollection<BsonDocument>("NotificationCampaigns")
            .Find(new BsonDocument("CreatedBy", account.ActorKey)).Limit(1001).ToListAsync(cancellationToken);
        result.AddRange(campaigns.Select(document => new BsonDocument { { "kind", "campaign-metadata" }, { "document", document } }));
        var consents = await Consents.Find(MongoConsentHistoryStore.AccountFilter(account)).Limit(1001).ToListAsync(cancellationToken);
        result.AddRange(consents.Select(document => new BsonDocument { { "kind", "consent-history" }, { "document", document } }));
        if (result.Count > 1000) throw new PrivacyBlockedException("export_limit_exceeded");
        return result;
    }

    public async Task EraseAsync(AccountReference account, CancellationToken cancellationToken)
    {
        var blockers = await InspectAsync(account, cancellationToken);
        if (blockers.Count != 0) throw new PrivacyBlockedException("privacy_inventory_blocked", StatusCodes.Status409Conflict);
        // Discard the entire response: answers, rare combinations and free text are not proven anonymous.
        await Responses.DeleteManyAsync(ResponseFilter(account), cancellationToken);
        // Author-controlled text is also unassessed. Delete complete definitions and their responses, not just attribution.
        using var authored = await Questionnaires.FindAsync(new BsonDocument("CreatedBy", account.ActorKey),
            cancellationToken: cancellationToken);
        while (await authored.MoveNextAsync(cancellationToken))
            foreach (var questionnaire in authored.Current)
            {
                await Responses.DeleteManyAsync(new BsonDocument("QuestionnaireId", questionnaire["_id"]), cancellationToken);
                await Questionnaires.DeleteOneAsync(new BsonDocument("_id", questionnaire["_id"]), cancellationToken);
            }
        await _database.GetCollection<BsonDocument>("NotificationCampaigns")
            .DeleteManyAsync(new BsonDocument("CreatedBy", account.ActorKey), cancellationToken);
        await Consents.DeleteManyAsync(MongoConsentHistoryStore.AccountFilter(account), cancellationToken);
        if (await Responses.Find(ResponseFilter(account)).AnyAsync(cancellationToken) ||
            await Questionnaires.Find(new BsonDocument("CreatedBy", account.ActorKey)).AnyAsync(cancellationToken) ||
            await Consents.Find(MongoConsentHistoryStore.AccountFilter(account)).AnyAsync(cancellationToken) ||
            await _database.GetCollection<BsonDocument>("NotificationCampaigns")
                .Find(new BsonDocument("CreatedBy", account.ActorKey)).AnyAsync(cancellationToken))
            throw new PrivacyBlockedException("application_erasure_not_verified");
    }

    private IMongoCollection<BsonDocument> Responses => _database.GetCollection<BsonDocument>(_settings.QuestionnaireResponseCollectionName);
    private IMongoCollection<BsonDocument> Questionnaires => _database.GetCollection<BsonDocument>(_settings.QuestionnaireCollectionName);
    private IMongoCollection<BsonDocument> Consents => _database.GetCollection<BsonDocument>(MongoConsentHistoryStore.CollectionName);

    public static BsonDocument ResponseFilter(AccountReference account) => new("$or", new BsonArray
    {
        new BsonDocument { { "AccountIssuer", account.Issuer }, { "AccountSubject", account.Subject } },
        new BsonDocument("UniqueAccountKey", new BsonDocument("$regex",
            "^" + System.Text.RegularExpressions.Regex.Escape(account.ActorKey) + "(?:$|\\|)"))
    });
}
