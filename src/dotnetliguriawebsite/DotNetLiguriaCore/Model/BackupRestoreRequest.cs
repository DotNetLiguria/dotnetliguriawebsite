namespace DotNetLiguriaCore.Model;

public sealed class BackupRestoreRequest
{
    public string SnapshotId { get; init; } = string.Empty;
    public bool ConfirmReplace { get; init; }
}
