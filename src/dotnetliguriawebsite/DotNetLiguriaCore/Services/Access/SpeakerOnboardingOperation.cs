namespace DotNetLiguriaCore.Services.Access;

public sealed record SpeakerOnboardingOperation(
    string CorrelationId, string Email, string State, string? Subject, string? Issuer = null);
