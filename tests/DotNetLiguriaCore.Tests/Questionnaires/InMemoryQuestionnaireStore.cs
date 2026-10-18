using System.Text.Json;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;

namespace DotNetLiguriaCore.Tests.Questionnaires;

// Stores deep copies so tests observe the same isolation as a real database.
public sealed class InMemoryQuestionnaireStore : IQuestionnaireStore
{
    private readonly Dictionary<Guid, Questionnaire> _questionnaires = [];
    private readonly List<QuestionnaireResponse> _responses = [];

    public IReadOnlyList<QuestionnaireResponse> Responses => _responses;

    public Task<List<Questionnaire>> ListAsync(CancellationToken cancellationToken = default, CollectionWindow? page = null) =>
        Task.FromResult(Window(_questionnaires.Values.OrderByDescending(q => q.UpdatedAt)
            .ThenBy(q => q.QuestionnaireId).Select(Copy), page));

    public Task<Questionnaire?> GetAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_questionnaires.TryGetValue(questionnaireId, out var q) ? Copy(q) : null);

    public Task<List<Questionnaire>> GetByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default,
        CollectionWindow? page = null) =>
        Task.FromResult(Window(_questionnaires.Values.Where(q => q.WorkshopId == workshopId)
            .OrderBy(q => q.QuestionnaireId).Select(Copy), page));

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

    public Task<Dictionary<Guid, long>> CountResponsesAsync(CancellationToken cancellationToken = default,
        IReadOnlyCollection<Guid>? questionnaireIds = null) =>
        Task.FromResult(_responses.Where(r => questionnaireIds is null || questionnaireIds.Contains(r.QuestionnaireId))
            .GroupBy(r => r.QuestionnaireId).ToDictionary(g => g.Key, g => (long)g.Count()));

    public Task<long> CountResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default) =>
        Task.FromResult((long)_responses.Count(r => r.QuestionnaireId == questionnaireId));

    public Task<List<QuestionnaireResponse>> GetResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default,
        CollectionWindow? page = null) =>
        Task.FromResult(Window(_responses.Where(r => r.QuestionnaireId == questionnaireId)
            .OrderBy(r => r.SubmittedAt).ThenBy(r => r.ResponseId), page));

    public Task<bool> HasResponseFromAsync(Guid questionnaireId, string uniqueEmailKey, CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.Any(r => r.QuestionnaireId == questionnaireId && r.UniqueAccountKey == uniqueEmailKey));

    public Task<bool> InsertResponseAsync(QuestionnaireResponse response, CancellationToken cancellationToken = default)
    {
        if (response.UniqueEmailKey is not null && _responses.Any(r => r.UniqueEmailKey == response.UniqueEmailKey))
        {
            return Task.FromResult(false);
        }
        if (response.UniqueAccountKey is not null && _responses.Any(r => r.UniqueAccountKey == response.UniqueAccountKey))
            return Task.FromResult(false);

        _responses.Add(response);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteResponseAsync(Guid questionnaireId, Guid responseId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_responses.RemoveAll(r => r.QuestionnaireId == questionnaireId && r.ResponseId == responseId) == 1);

    public void AddResponse(QuestionnaireResponse response) => _responses.Add(response);

    private static List<T> Window<T>(IEnumerable<T> source, CollectionWindow? page)
    {
        if (page is null) return source.ToList();
        var result = source.Skip(page.Offset).Take(page.Limit + 1).ToList();
        page.HasMore = result.Count > page.Limit;
        return result.Take(page.Limit).ToList();
    }

    private static Questionnaire Copy(Questionnaire questionnaire) =>
        JsonSerializer.Deserialize<Questionnaire>(JsonSerializer.Serialize(questionnaire))!;
}
