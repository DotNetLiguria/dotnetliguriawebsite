namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterProductionSendRequest(int Version, Guid SnapshotId, string ConfirmationId);
