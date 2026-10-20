namespace DotNetLiguriaCore.Services.Access;

public sealed record BoardAccountLinkRequest(string Subject, string? ExpectedEmail, bool MatchEmail = true);
