namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessUserSearchPage(
    IReadOnlyList<AccessUserSummary> Users, int First, int Max, bool HasMore);
