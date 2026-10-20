using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Access;

internal sealed class FakeSpeakerAccountStore : ISpeakerAccountStore
{
    public WorkshopSpeaker Profile { get; } = new()
    {
        WorkshopSpeakerId = Guid.Parse("44444444-4444-4444-4444-444444444444"),
        Name = "Speaker", Email = "speaker@example.test"
    };
    public SpeakerOnboardingOperation? Operation { get; set; }
    public bool HasIndex { get; set; } = true;
    public bool IgnoreLink { get; set; }
    public int Links { get; private set; }
    public Task<WorkshopSpeaker?> GetAsync(Guid id) => Task.FromResult<WorkshopSpeaker?>(Profile);
    public Task RequireIdentityIndexAsync(CancellationToken cancellationToken) =>
        HasIndex ? Task.CompletedTask : throw new PrivacyBlockedException("speaker_account_index_required");
    public Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken)
    {
        if (Profile.AccountIssuer is not null || Profile.AccountSubject is not null || Profile.Email != expectedEmail)
            throw new PrivacyBlockedException("speaker_profile_changed", 409);
        Links++;
        if (!IgnoreLink) { Profile.AccountIssuer = account.Issuer; Profile.AccountSubject = account.Subject; }
        return Task.CompletedTask;
    }
    public Task<SpeakerOnboardingOperation?> GetOperationAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Operation);
    public Task ReserveCreationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken)
    {
        if (Operation is not null) throw new PrivacyBlockedException("speaker_account_creation_already_attempted", 409);
        Operation = operation;
        return Task.CompletedTask;
    }
    public Task SaveOperationAsync(Guid id, SpeakerOnboardingOperation operation, CancellationToken cancellationToken)
    {
        Operation = operation;
        return Task.CompletedTask;
    }
}
