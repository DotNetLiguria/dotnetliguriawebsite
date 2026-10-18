namespace DotNetLiguriaCore.Services.Privacy;

public static class PrivacyStoragePaths
{
    public static string ValidateBackupRoot(string root, string contentRoot)
    {
        if (string.IsNullOrWhiteSpace(root))
            throw new PrivacyBlockedException("backup_storage_not_configured");
        var full = Path.GetFullPath(Path.IsPathRooted(root) ? root : Path.Combine(contentRoot, root));
        var content = Path.GetFullPath(contentRoot);
        if (IsWithin(full, Path.Combine(content, "wwwroot")) ||
            IsWithin(full, Path.Combine(content, "Contents")) || IsWithin(content, full))
            throw new PrivacyBlockedException("unsafe_backup_storage");
        RejectLinks(full);
        return full;
    }

    public static void RejectLinks(string path)
    {
        for (var current = new DirectoryInfo(Path.GetFullPath(path)); current is not null; current = current.Parent)
            if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0)
                throw new PrivacyBlockedException("linked_storage_not_supported");
    }

    public static bool IsWithin(string path, string root)
    {
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        path = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        return path.Equals(root, comparison) || path.StartsWith(root + Path.DirectorySeparatorChar, comparison);
    }
}
