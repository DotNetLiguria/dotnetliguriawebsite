namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed record PrivacyNoticeSendResult(bool Accepted, string? ErrorCode);
