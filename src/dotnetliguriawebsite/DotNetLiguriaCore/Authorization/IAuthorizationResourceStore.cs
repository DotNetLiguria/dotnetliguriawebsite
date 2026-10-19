using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Authorization;

public interface IAuthorizationResourceStore
{
    Task<Workshop?> GetEventAsync(Guid id, CancellationToken cancellationToken);
    Task<Questionnaire?> GetQuestionnaireAsync(Guid id, CancellationToken cancellationToken);
    Task<Guid?> GetAssetEventAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Workshop>> GetHomepageEventsAsync(CancellationToken cancellationToken);
}
