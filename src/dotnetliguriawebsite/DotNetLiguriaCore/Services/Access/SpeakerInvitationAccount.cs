namespace DotNetLiguriaCore.Services.Access;

public sealed record SpeakerInvitationAccount(string Email, bool Enabled, bool IsServiceAccount,
    IReadOnlyList<string> RequiredActions);
