using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Notifications;

internal sealed record UnsubscribePayload(AccountReference Account, string Purpose, DateTimeOffset ExpiresAt);
