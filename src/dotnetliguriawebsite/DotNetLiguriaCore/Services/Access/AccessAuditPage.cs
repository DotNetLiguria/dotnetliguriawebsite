namespace DotNetLiguriaCore.Services.Access;

public sealed record AccessAuditPage(
    IReadOnlyList<AccessAuditEntry> Entries, int First, int Max, bool HasMore);
