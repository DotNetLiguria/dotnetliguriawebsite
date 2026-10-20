namespace DotNetLiguriaCore.Services.Access;

public sealed record BoardAccountStatus(
    Guid BoardId, string? Email, AccessUserSummary? Account, bool IsMember,
    IReadOnlyList<AccessUserSummary> Candidates);
