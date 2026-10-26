using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Storage;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class WebsiteStoragePathsTests
{
    [Fact]
    public void Configured_storage_roots_stay_under_the_test_project()
    {
        var root = Path.Combine(AppContext.BaseDirectory, "TestData", "StorageRoots");
        var contentRoot = Path.Combine(root, "website");
        var environment = new PrivacyTestEnvironment(contentRoot) { EnvironmentName = Environments.Development };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:ContentsRoot"] = Path.Combine(root, "contents"),
            ["Storage:DataRoot"] = Path.Combine(root, "data"),
            ["Storage:BackupsRoot"] = Path.Combine(root, "backups"),
            ["Storage:NotInSnapshotRoot"] = Path.Combine(root, "not-in-snapshot")
        }).Build();
        var paths = new WebsiteStoragePaths(configuration, environment);

        Assert.Equal(Path.Combine(root, "contents"), paths.ContentsRoot);
        Assert.Equal(Path.Combine(root, "data"), paths.DataRoot);
        Assert.Equal(Path.Combine(root, "backups"), paths.BackupsRoot);
        Assert.Equal(Path.Combine(root, "not-in-snapshot"), paths.NotInSnapshotRoot);
        Assert.Equal(Path.Combine(root, "data", "private-uploads"), paths.PrivateUploadsRoot);
        Assert.Equal(Path.Combine(root, "data", "profile-photos"), paths.ProfilePhotosRoot);
        Assert.Equal(Path.Combine(root, "not-in-snapshot", "data-protection-keys"), paths.DataProtectionKeysRoot);
        Assert.Equal(Path.Combine(root, "not-in-snapshot", "logs"), paths.LogsRoot);
        Assert.Equal(Path.Combine(root, "not-in-snapshot", "newsletter-operations"), paths.NewsletterOperationsRoot);
    }

    [Fact]
    public void Production_storage_roots_match_the_container_mount_layout()
    {
        var environment = new PrivacyTestEnvironment(Path.GetFullPath("/app"));
        var paths = new WebsiteStoragePaths(new ConfigurationBuilder().Build(), environment);

        Assert.Equal(Path.GetFullPath("/app/Contents"), paths.ContentsRoot);
        Assert.Equal(Path.GetFullPath("/data"), paths.DataRoot);
        Assert.Equal(Path.GetFullPath("/backups"), paths.BackupsRoot);
        Assert.Equal(Path.GetFullPath("/not-in-snapshot"), paths.NotInSnapshotRoot);
    }
}
