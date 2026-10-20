namespace DotNetLiguriaCore.Services.Access;

public sealed record SpeakerAccountStatus(Guid SpeakerId, string? Email, AccessUserSummary? Account,
    IReadOnlyList<AccessUserSummary> Candidates, string? OnboardingState);
