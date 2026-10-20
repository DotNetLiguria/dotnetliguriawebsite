using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Access;

public sealed class MongoSpeakerAccountStore : ISpeakerAccountStore
{
    public const string OperationsCollectionSuffix = "AccountOperations";
    private readonly SpeakerService _speakers;
    private readonly IMongoCollection<WorkshopSpeaker> _profiles;
    private readonly IMongoCollection<BsonDocument> _operations;

    public MongoSpeakerAccountStore(SpeakerService speakers, IOptions<DotNetLiguriaDatabaseSettings> settings)
    {
        _speakers = speakers;
        var database = new MongoClient(settings.Value.ConnectionString).GetDatabase(settings.Value.DatabaseName);
        _profiles = database.GetCollection<WorkshopSpeaker>(settings.Value.SpeakerCollectionName);
        _operations = database.GetCollection<BsonDocument>(settings.Value.SpeakerCollectionName + OperationsCollectionSuffix);
    }

    public Task<WorkshopSpeaker?> GetAsync(Guid id) => _speakers.GetAsync(id);

    public static BsonDocument OperationAccountFilter(AccountReference account) =>
        new() { { "Issuer", account.Issuer }, { "Subject", account.Subject } };

    public async Task RequireIdentityIndexAsync(CancellationToken cancellationToken)
    {
        using var indexes = await _profiles.Indexes.ListAsync(cancellationToken);
        if (!(await indexes.ToListAsync(cancellationToken)).Any(BoardService.IsAccountLinkIndex))
            throw new PrivacyBlockedException("speaker_account_index_required", 503);
    }

    public async Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken)
    {
        await RequireIdentityIndexAsync(cancellationToken);
        var filter = Builders<WorkshopSpeaker>.Filter.Where(profile =>
            profile.WorkshopSpeakerId == id && profile.AccountIssuer == null &&
            profile.AccountSubject == null && profile.Email == expectedEmail);
        try
        {
            var result = await _profiles.UpdateOneAsync(filter, Builders<WorkshopSpeaker>.Update
                .Set(profile => profile.AccountIssuer, account.Issuer)
                .Set(profile => profile.AccountSubject, account.Subject), cancellationToken: cancellationToken);
            if (result.MatchedCount != 1) throw new PrivacyBlockedException("speaker_profile_changed", 409);
        }
        catch (MongoWriteException exception) when (exception.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new PrivacyBlockedException("speaker_account_already_linked", 409);
        }
    }

    public async Task<SpeakerOnboardingOperation?> GetOperationAsync(Guid id, CancellationToken cancellationToken)
    {
        var document = await _operations.Find(new BsonDocument("_id", id.ToString("D")))
            .FirstOrDefaultAsync(cancellationToken);
        return document is null ? null : new(document["CorrelationId"].AsString, document["Email"].AsString,
            document["State"].AsString, document["Subject"].IsBsonNull ? null : document["Subject"].AsString,
            document.GetValue("Issuer", BsonNull.Value).IsBsonNull ? null : document["Issuer"].AsString);
    }

    public async Task ReserveCreationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken)
    {
        try { await _operations.InsertOneAsync(Document(id, operation), cancellationToken: cancellationToken); }
        catch (MongoWriteException exception) when (exception.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new PrivacyBlockedException("speaker_account_creation_already_attempted", 409);
        }
    }

    public async Task SaveOperationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken)
    {
        var result = await _operations.ReplaceOneAsync(new BsonDocument
            { { "_id", id.ToString("D") }, { "CorrelationId", operation.CorrelationId } },
            Document(id, operation), cancellationToken: cancellationToken);
        if (result.MatchedCount != 1) throw new PrivacyBlockedException("speaker_onboarding_state_changed", 409);
    }

    private static BsonDocument Document(Guid id, SpeakerOnboardingOperation operation) => new()
    {
        { "_id", id.ToString("D") }, { "CorrelationId", operation.CorrelationId },
        { "Email", operation.Email }, { "State", operation.State },
        { "Issuer", operation.Issuer is null ? BsonNull.Value : new BsonString(operation.Issuer) },
        { "Subject", operation.Subject is null ? BsonNull.Value : new BsonString(operation.Subject) }
    };
}
