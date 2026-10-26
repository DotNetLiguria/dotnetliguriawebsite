using DotNetLiguriaCore.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestEnvironment : IWebHostEnvironment
{
    public NewsletterTestEnvironment()
    {
        var testData = Path.Combine(AppContext.BaseDirectory, "TestData");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Storage:ContentsRoot"] = Path.Combine(testData, "Contents"),
            ["Storage:DataRoot"] = Path.Combine(testData, "Storage", "data"),
            ["Storage:BackupsRoot"] = Path.Combine(testData, "Storage", "backups"),
            ["Storage:NotInSnapshotRoot"] = Path.Combine(testData, "Storage", "not-in-snapshot")
        }).Build();
        StoragePaths = new WebsiteStoragePaths(configuration, this);
    }

    public WebsiteStoragePaths StoragePaths { get; }
    public string ApplicationName { get; set; } = "NewsletterTests";
    public string EnvironmentName { get; set; } = "Testing";
    public string WebRootPath { get; set; } = "";
    public string ContentRootPath { get; set; } = FindContentRoot();
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();

    private static string FindContentRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
            directory = directory.Parent;
        return Path.Combine(directory!.FullName, "src", "dotnetliguriawebsite", "DotNetLiguriaCore");
    }
}
