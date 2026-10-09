using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services.Questionnaires;

public class MongoQuestionnaireStore : IQuestionnaireStore
{
    private readonly IMongoCollection<Questionnaire> _questionnaires;
    private readonly IMongoCollection<QuestionnaireResponse> _responses;
    private Task? _indexes;

    public MongoQuestionnaireStore(IOptions<DotNetLiguriaDatabaseSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var database = client.GetDatabase(settings.Value.DatabaseName);
        _questionnaires = database.GetCollection<Questionnaire>(settings.Value.QuestionnaireCollectionName);
        _responses = database.GetCollection<QuestionnaireResponse>(settings.Value.QuestionnaireResponseCollectionName);
    }

    public async Task<List<Questionnaire>> ListAsync(CancellationToken cancellationToken = default) =>
        await _questionnaires.Find(_ => true).SortByDescending(q => q.UpdatedAt).ToListAsync(cancellationToken);

    public async Task<Questionnaire?> GetAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        await _questionnaires.Find(q => q.QuestionnaireId == questionnaireId).FirstOrDefaultAsync(cancellationToken);

    public async Task<List<Questionnaire>> GetByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default) =>
        await _questionnaires.Find(q => q.WorkshopId == workshopId).ToListAsync(cancellationToken);

    public async Task CreateAsync(Questionnaire questionnaire, CancellationToken cancellationToken = default)
    {
        await EnsureIndexesAsync();
        await _questionnaires.InsertOneAsync(questionnaire, cancellationToken: cancellationToken);
    }

    public async Task<bool> ReplaceAsync(Questionnaire questionnaire, int expectedVersion, CancellationToken cancellationToken = default)
    {
        var result = await _questionnaires.ReplaceOneAsync(
            q => q.QuestionnaireId == questionnaire.QuestionnaireId && q.Version == expectedVersion,
            questionnaire,
            cancellationToken: cancellationToken);
        return result.MatchedCount == 1;
    }

    public async Task DeleteAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        await _responses.DeleteManyAsync(r => r.QuestionnaireId == questionnaireId, cancellationToken);
        await _questionnaires.DeleteOneAsync(q => q.QuestionnaireId == questionnaireId, cancellationToken);
    }

    public async Task<Dictionary<Guid, long>> CountResponsesAsync(CancellationToken cancellationToken = default)
    {
        var groups = await _responses.Aggregate()
            .Group(r => r.QuestionnaireId, g => new { QuestionnaireId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        return groups.ToDictionary(g => g.QuestionnaireId, g => (long)g.Count);
    }

    public Task<long> CountResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        _responses.CountDocumentsAsync(r => r.QuestionnaireId == questionnaireId, cancellationToken: cancellationToken);

    public async Task<List<QuestionnaireResponse>> GetResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        await _responses.Find(r => r.QuestionnaireId == questionnaireId).SortBy(r => r.SubmittedAt).ToListAsync(cancellationToken);

    public async Task<bool> HasResponseFromAsync(Guid questionnaireId, string uniqueEmailKey, CancellationToken cancellationToken = default) =>
        await _responses.Find(r => r.QuestionnaireId == questionnaireId && r.UniqueEmailKey == uniqueEmailKey)
            .AnyAsync(cancellationToken);

    public async Task<bool> InsertResponseAsync(QuestionnaireResponse response, CancellationToken cancellationToken = default)
    {
        await EnsureIndexesAsync();
        try
        {
            await _responses.InsertOneAsync(response, cancellationToken: cancellationToken);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task<bool> DeleteResponseAsync(Guid questionnaireId, Guid responseId, CancellationToken cancellationToken = default)
    {
        var result = await _responses.DeleteOneAsync(
            r => r.QuestionnaireId == questionnaireId && r.ResponseId == responseId, cancellationToken);
        return result.DeletedCount == 1;
    }

    private async Task EnsureIndexesAsync()
    {
        var task = _indexes ??= CreateIndexesAsync();
        try
        {
            await task;
        }
        catch (MongoException)
        {
            _ = Interlocked.CompareExchange(ref _indexes, null, task);
            // Index creation is retried on the next write; the pre-insert check still applies.
        }
    }

    private async Task CreateIndexesAsync()
    {
        var keys = Builders<QuestionnaireResponse>.IndexKeys;
        await _responses.Indexes.CreateManyAsync(
        [
            new CreateIndexModel<QuestionnaireResponse>(keys.Ascending(r => r.QuestionnaireId).Ascending(r => r.SubmittedAt)),
            new CreateIndexModel<QuestionnaireResponse>(keys.Ascending(r => r.UniqueEmailKey),
                new CreateIndexOptions { Unique = true, Sparse = true, Name = "UniqueEmailKey_unique" }),
            new CreateIndexModel<QuestionnaireResponse>(keys.Ascending(r => r.SourceKey),
                new CreateIndexOptions { Unique = true, Sparse = true, Name = "SourceKey_unique" }),
        ]);
        await _questionnaires.Indexes.CreateOneAsync(
            new CreateIndexModel<Questionnaire>(Builders<Questionnaire>.IndexKeys.Ascending(q => q.WorkshopId)));
    }
}
