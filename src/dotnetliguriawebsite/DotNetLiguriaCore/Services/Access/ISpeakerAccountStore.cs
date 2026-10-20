using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Access;

public interface ISpeakerAccountStore
{
    Task<WorkshopSpeaker?> GetAsync(Guid id);
    Task RequireIdentityIndexAsync(CancellationToken cancellationToken);
    Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken);
    Task<SpeakerOnboardingOperation?> GetOperationAsync(Guid id, CancellationToken cancellationToken);
    Task ReserveCreationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken);
    Task SaveOperationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken);
}
