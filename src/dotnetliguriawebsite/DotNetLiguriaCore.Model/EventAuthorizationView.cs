namespace DotNetLiguriaCore.Model;

public sealed record EventAuthorizationView(bool IsPast, IReadOnlyList<string> AllowedActions, string? ScheduleErrorCode = null);
