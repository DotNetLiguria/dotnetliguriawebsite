namespace DotNetLiguriaCore.Authorization;

public class BackupAuthorizationOptions
{
    public const string SectionName = "BackupAuthorization";
    public const string PolicyName = "DatabaseBackupAdmin";

    public string AdminRole { get; set; } = "backupadmin";
    public string AdminClaim { get; set; } = "backupadmin";
}
