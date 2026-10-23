namespace DotNetLiguriaCore.Storage;

public sealed class WebsiteStoragePaths
{
    public WebsiteStoragePaths(IConfiguration configuration, IHostEnvironment environment)
    {
        var repositoryRoot = FindRepositoryRoot(environment.ContentRootPath);
        var defaultContentsRoot = repositoryRoot is null
            ? environment.IsDevelopment()
                ? Path.Combine(environment.ContentRootPath, "Contents")
                : "/app/Contents"
            : Path.Combine(repositoryRoot, ".persisted", "contents");
        var defaultDataRoot = repositoryRoot is null
            ? environment.IsDevelopment()
                ? Path.Combine(environment.ContentRootPath, ".persisted", "data")
                : "/data"
            : Path.Combine(repositoryRoot, ".persisted", "data");
        var defaultBackupsRoot = repositoryRoot is null
            ? environment.IsDevelopment()
                ? Path.Combine(environment.ContentRootPath, ".persisted", "backups")
                : "/backups"
            : Path.Combine(repositoryRoot, ".persisted", "backups");
        var defaultNotInSnapshotRoot = repositoryRoot is null
            ? environment.IsDevelopment()
                ? Path.Combine(environment.ContentRootPath, ".persisted", "not-in-snapshot")
                : "/not-in-snapshot"
            : Path.Combine(repositoryRoot, ".persisted", "not-in-snapshot");

        ContentsRoot = Resolve(configuration["Storage:ContentsRoot"], defaultContentsRoot,
            environment.ContentRootPath);
        DataRoot = Resolve(configuration["Storage:DataRoot"], defaultDataRoot,
            environment.ContentRootPath);
        BackupsRoot = Resolve(configuration["Storage:BackupsRoot"], defaultBackupsRoot,
            environment.ContentRootPath);
        NotInSnapshotRoot = Resolve(configuration["Storage:NotInSnapshotRoot"], defaultNotInSnapshotRoot,
            environment.ContentRootPath);
    }

    public string ContentsRoot { get; }
    public string DataRoot { get; }
    public string BackupsRoot { get; }
    public string NotInSnapshotRoot { get; }
    public string DataProtectionKeysRoot => Path.Combine(NotInSnapshotRoot, "data-protection-keys");
    public string LogsRoot => Path.Combine(NotInSnapshotRoot, "logs");
    public string NewsletterOperationsRoot => Path.Combine(NotInSnapshotRoot, "newsletter-operations");
    public string PrivateUploadsRoot => Path.Combine(DataRoot, "private-uploads");
    public string ProfilePhotosRoot => Path.Combine(DataRoot, "profile-photos");

    public void EnsureDirectories()
    {
        Directory.CreateDirectory(ContentsRoot);
        Directory.CreateDirectory(BackupsRoot);
        Directory.CreateDirectory(NotInSnapshotRoot);
        Directory.CreateDirectory(DataProtectionKeysRoot);
        Directory.CreateDirectory(LogsRoot);
        Directory.CreateDirectory(NewsletterOperationsRoot);
        Directory.CreateDirectory(PrivateUploadsRoot);
        Directory.CreateDirectory(ProfilePhotosRoot);
    }

    public static string ResolveContentsRoot(IHostEnvironment environment) =>
        new WebsiteStoragePaths(new ConfigurationBuilder().Build(), environment).ContentsRoot;

    public static string ResolvePrivateUploadsRoot(IHostEnvironment environment) =>
        new WebsiteStoragePaths(new ConfigurationBuilder().Build(), environment).PrivateUploadsRoot;

    private static string Resolve(string? configuredPath, string defaultPath, string contentRoot)
    {
        var path = string.IsNullOrWhiteSpace(configuredPath) ? defaultPath : configuredPath;
        return Path.GetFullPath(path, contentRoot);
    }

    private static string? FindRepositoryRoot(string contentRoot)
    {
        for (var directory = new DirectoryInfo(Path.GetFullPath(contentRoot)); directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
                return directory.FullName;
        }

        return null;
    }
}
