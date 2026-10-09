using System.Text.Json;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;

namespace DotNetLiguriaCore.Tests.Questionnaires;

// Stores deep copies so tests observe the same isolation as a real database.
public sealed class InMemoryQuestionnaireStore : IQuestionnaireStore
{
    private readonly Dictionary<Guid, Questionnaire> _questionnaires = [];
    private readonly List<QuestionnaireResponse> _responses = [];

    public IReadOnlyList<QuestionnaireResponse> Responses => _responses;

    public Task<List<Questionnaire>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(_questionnaires.Values.Select(Copy).ToList());

    public Task<Questionnaire?> GetAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_questionnaires.TryGetValue(questionnaireId, out var q) ? Copy(q) : null);

    public Task<List<Questionnaire>> GetByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_questionnaires.Values.Where(q => q.WorkshopId == workshopId).Select(Copy).ToList());

    public Task CreateAsync(Questionnaire questionnaire, CancellationToken cancellationToken = default)
    {
        _questionnaires.Add(questionnaire.QuestionnaireId, Copy(questionnaire));
        return Task.CompletedTask;
    }

    public Task<bool> ReplaceAsync(Questionnaire questionnaire, int expectedVersion, CancellationToken cancellationToken = default)
    {
        if (!_questionnaires.TryGetValue(questionnaire.QuestionnaireId, out var stored) || stored.Version != expectedVersion)
        {
            return Task.FromResult(false);
        }

        _questionnaires[questionnaire.QuestionnaireId] = Copy(questionnaire);
        return Task.FromResult(true);
    }

    public Task DeleteAsync(Guid questionnaireId, CancellationToken cancellationToken = default)
    {
        _questionnaires.Remove(questionnaireId);
        _responses.RemoveAll(r => r.QuestionnaireId == questionnaireId);
        return Task.CompletedTask;
    }

    public Task<Dictionary<Guid, long>> CountResponsesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.GroupBy(r => r.QuestionnaireId).ToDictionary(g => g.Key, g => (long)g.Count()));

    public Task<long> CountResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        Task.FromResult((long)_responses.Count(r => r.QuestionnaireId == questionnaireId));

    public Task<List<QuestionnaireResponse>> GetResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.Where(r => r.QuestionnaireId == questionnaireId).ToList());

    public Task<bool> HasResponseFromAsync(Guid questionnaireId, string uniqueEmailKey, CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.Any(r => r.QuestionnaireId == questionnaireId && r.UniqueEmailKey == uniqueEmailKey));

    public Task<bool> InsertResponseAsync(QuestionnaireResponse response, CancellationToken cancellationToken = default)
    {
        if (response.UniqueEmailKey is not null && _responses.Any(r => r.UniqueEmailKey == response.UniqueEmailKey))
        {
            return Task.FromResult(false);
        }

        _responses.Add(response);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteResponseAsync(Guid questionnaireId, Guid responseId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.RemoveAll(r => r.QuestionnaireId == questionnaireId && r.ResponseId == responseId) == 1);

    public void AddResponse(QuestionnaireResponse response) => _responses.Add(response);

    private static Questionnaire Copy(Questionnaire questionnaire) =>
        JsonSerializer.Deserialize<Questionnaire>(JsonSerializer.Serialize(questionnaire))!;
}
