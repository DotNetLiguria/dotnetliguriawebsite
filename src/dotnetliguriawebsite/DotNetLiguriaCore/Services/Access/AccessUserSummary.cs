namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessUserSummary(
    string Issuer, string Subject, string? Username, bool Enabled, bool? ProtectedTarget = null);
