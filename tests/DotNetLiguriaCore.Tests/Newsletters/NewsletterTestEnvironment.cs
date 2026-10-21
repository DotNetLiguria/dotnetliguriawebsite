using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestEnvironment : IWebHostEnvironment
{
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
