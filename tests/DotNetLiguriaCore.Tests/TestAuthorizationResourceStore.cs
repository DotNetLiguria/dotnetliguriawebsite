using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Tests;

public sealed class TestAuthorizationResourceStore : IAuthorizationResourceStore
{
    public Dictionary<Guid, Workshop> Events { get; } = [];
    public Dictionary<Guid, Questionnaire> Questionnaires { get; } = [];
    public Dictionary<Guid, Guid> AssetEvents { get; } = [];

    public Task<Workshop?> GetEventAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Events.GetValueOrDefault(id));
    public Task<Questionnaire?> GetQuestionnaireAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Questionnaires.GetValueOrDefault(id));
    public Task<Guid?> GetAssetEventAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(AssetEvents.TryGetValue(id, out var eventId) ? (Guid?)eventId : null);
    public Task<IReadOnlyList<Workshop>> GetHomepageEventsAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Workshop>>(Events.Values.Where(item => item.In_homepage).ToArray());
}
