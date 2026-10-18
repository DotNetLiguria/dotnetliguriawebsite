namespace DotNetLiguriaCore.Services.Privacy;

public sealed record ErasureOperation(string Id, AccountReference Account, string Stage)
{
    public string NoticeStatus { get; init; } = "not_required";
    public int NoticeAttempts { get; init; }
    public DateTimeOffset? NoticeNextAttemptAt { get; init; }
    public string? NoticeErrorCode { get; init; }
    public string? NoticeAttemptToken { get; init; }
}
