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
    public void Development_storage_roots_are_siblings_under_persisted()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), "website-storage-paths", Guid.NewGuid().ToString("N"));
        var environment = new PrivacyTestEnvironment(contentRoot) { EnvironmentName = Environments.Development };
        var paths = new WebsiteStoragePaths(new ConfigurationBuilder().Build(), environment);
        var persisted = Path.Combine(contentRoot, ".persisted");

        Assert.Equal(Path.Combine(contentRoot, "Contents"), paths.ContentsRoot);
        Assert.Equal(Path.Combine(persisted, "data"), paths.DataRoot);
        Assert.Equal(Path.Combine(persisted, "backups"), paths.BackupsRoot);
        Assert.Equal(Path.Combine(persisted, "not-in-snapshot"), paths.NotInSnapshotRoot);
        Assert.Equal(Path.Combine(persisted, "data", "private-uploads"), paths.PrivateUploadsRoot);
        Assert.Equal(Path.Combine(persisted, "data", "profile-photos"), paths.ProfilePhotosRoot);
        Assert.Equal(Path.Combine(persisted, "not-in-snapshot", "data-protection-keys"), paths.DataProtectionKeysRoot);
        Assert.Equal(Path.Combine(persisted, "not-in-snapshot", "logs"), paths.LogsRoot);
        Assert.Equal(Path.Combine(persisted, "not-in-snapshot", "newsletter-operations"), paths.NewsletterOperationsRoot);
    }

    [Fact]
    public void Production_storage_roots_match_the_container_mount_layout()
    {
        var environment = new PrivacyTestEnvironment(Path.Combine(Path.GetTempPath(), "website-storage-container"));
        var paths = new WebsiteStoragePaths(new ConfigurationBuilder().Build(), environment);

        Assert.Equal(Path.GetFullPath("/app/Contents"), paths.ContentsRoot);
        Assert.Equal(Path.GetFullPath("/data"), paths.DataRoot);
        Assert.Equal(Path.GetFullPath("/backups"), paths.BackupsRoot);
        Assert.Equal(Path.GetFullPath("/not-in-snapshot"), paths.NotInSnapshotRoot);
    }
}
