using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Access;

internal sealed class FakeSpeakerOnboardingDirectory(FakeAccessPermissionDirectory directory) : ISpeakerOnboardingDirectory
{
    private readonly FakeAccessPermissionDirectory _directory = directory;
    public const string Subject = "22222222-2222-2222-2222-222222222222";
    public int Creates { get; private set; }
    public int Invitations { get; private set; }
    public bool FailCreate { get; set; }
    public bool FailInvitation { get; set; }
    public bool BadConfiguration { get; set; }
    public string Email { get; set; } = "speaker@example.test";
    public IReadOnlyList<string> Actions { get; set; } = ["UPDATE_PASSWORD", "VERIFY_EMAIL"];
    public IReadOnlyList<string>? SentActions { get; private set; }
    public void ValidateInvitationConfiguration()
    {
        if (BadConfiguration) throw new PrivacyBlockedException("speaker_invitation_not_configured");
    }
    public Task<AccountReference> CreateSpeakerAccountAsync(string email, CancellationToken cancellationToken)
    {
        Creates++;
        if (FailCreate) throw new HttpRequestException("Transport uncertain");
        Email = email;
        _directory.AddUser(new(AccessManagementServiceTests.Issuer, Subject, email, true), email: email);
        return Task.FromResult(new AccountReference(AccessManagementServiceTests.Issuer, Subject));
    }
    public Task<SpeakerInvitationAccount> ReadInvitationAccountAsync(AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult(new SpeakerInvitationAccount(Email, true, false, Actions));
    public Task SendSpeakerInvitationAsync(AccountReference account, IReadOnlyList<string> actions, CancellationToken cancellationToken)
    {
        Invitations++;
        SentActions = actions;
        if (FailInvitation) throw new HttpRequestException("Email failed");
        return Task.CompletedTask;
    }
}
