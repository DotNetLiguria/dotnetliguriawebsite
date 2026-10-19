using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;

namespace DotNetLiguriaCore.Authorization;

public sealed class AuthorizationResourceStore(
    WorkshopService workshops, QuestionnaireService questionnaires, WorkshopFileService files) : IAuthorizationResourceStore
{
    private readonly WorkshopService _workshops = workshops;
    private readonly QuestionnaireService _questionnaires = questionnaires;
    private readonly WorkshopFileService _files = files;

    public Task<Workshop?> GetEventAsync(Guid id, CancellationToken cancellationToken) => _workshops.GetAsync(id);
    public Task<Questionnaire?> GetQuestionnaireAsync(Guid id, CancellationToken cancellationToken) =>
        _questionnaires.GetAsync(id, cancellationToken);
    public async Task<Guid?> GetAssetEventAsync(Guid id, CancellationToken cancellationToken) =>
        (await _files.GetFileAsync(id))?.WorkshopId;
    public async Task<IReadOnlyList<Workshop>> GetHomepageEventsAsync(CancellationToken cancellationToken) =>
        (await _workshops.GetAsync()).Where(workshop => workshop.In_homepage).ToArray();
}
