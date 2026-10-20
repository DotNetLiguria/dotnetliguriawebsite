namespace DotNetLiguriaCore.Model;

public sealed record BackupSnapshotInfo(
    string SnapshotId,
    DateTime CreatedAtUtc,
    int CollectionCount,
    long DocumentCount,
    bool IsSafetySnapshot,
    string? Name = null);
