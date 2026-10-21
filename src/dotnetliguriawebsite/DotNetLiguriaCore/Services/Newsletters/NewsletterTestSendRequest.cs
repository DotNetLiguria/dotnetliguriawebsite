namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTestSendRequest(int Version, Guid SnapshotId, string Recipient);
