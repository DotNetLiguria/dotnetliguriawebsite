using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class PrivacyTestEnvironment(string root) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = "Testing";
    public string ApplicationName { get; set; } = "PrivacyTests";
    public string ContentRootPath { get; set; } = root;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
