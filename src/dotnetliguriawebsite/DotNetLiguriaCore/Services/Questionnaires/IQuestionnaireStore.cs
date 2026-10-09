using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public interface IQuestionnaireStore
{
    Task<List<Questionnaire>> ListAsync(CancellationToken cancellationToken = default);
    Task<Questionnaire?> GetAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<List<Questionnaire>> GetByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default);
    Task CreateAsync(Questionnaire questionnaire, CancellationToken cancellationToken = default);

    // Returns false when the stored version differs from expectedVersion (concurrent edit).
    Task<bool> ReplaceAsync(Questionnaire questionnaire, int expectedVersion, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid questionnaireId, CancellationToken cancellationToken = default);

    Task<Dictionary<Guid, long>> CountResponsesAsync(CancellationToken cancellationToken = default);
    Task<long> CountResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<List<QuestionnaireResponse>> GetResponsesAsync(Guid questionnaireId, CancellationToken cancellationToken = default);
    Task<bool> HasResponseFromAsync(Guid questionnaireId, string uniqueEmailKey, CancellationToken cancellationToken = default);

    // Returns false when a response with the same UniqueEmailKey already exists.
    Task<bool> InsertResponseAsync(QuestionnaireResponse response, CancellationToken cancellationToken = default);

    Task<bool> DeleteResponseAsync(Guid questionnaireId, Guid responseId, CancellationToken cancellationToken = default);
}
