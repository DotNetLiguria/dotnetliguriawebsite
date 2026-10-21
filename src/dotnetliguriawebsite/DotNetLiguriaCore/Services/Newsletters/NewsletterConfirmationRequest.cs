namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterConfirmationRequest(int Version, Guid SnapshotId, bool VisualApproved);
