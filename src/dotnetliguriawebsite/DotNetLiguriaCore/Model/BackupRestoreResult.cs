namespace DotNetLiguriaCore.Model;

public sealed record BackupRestoreResult(
    string RestoredSnapshotId,
    BackupSnapshotInfo SafetySnapshot);
