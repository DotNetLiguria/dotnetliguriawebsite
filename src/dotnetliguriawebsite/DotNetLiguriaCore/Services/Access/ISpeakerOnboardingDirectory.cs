using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Access;

public interface ISpeakerOnboardingDirectory
{
    void ValidateInvitationConfiguration();
    Task<AccountReference> CreateSpeakerAccountAsync(string email, CancellationToken cancellationToken);
    Task<SpeakerInvitationAccount> ReadInvitationAccountAsync(AccountReference account, CancellationToken cancellationToken);
    Task SendSpeakerInvitationAsync(AccountReference account, IReadOnlyList<string> actions, CancellationToken cancellationToken);
}
