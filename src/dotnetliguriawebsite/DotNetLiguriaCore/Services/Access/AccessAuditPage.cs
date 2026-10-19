namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessAuditPage(
    IReadOnlyList<AccessAuditView> Entries, int First, int Max, bool HasMore);
