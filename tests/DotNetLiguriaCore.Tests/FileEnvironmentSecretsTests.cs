using CommonWeb;

using Xunit;

namespace DotNetLiguriaCore.Tests;

public class FileEnvironmentSecretsTests
{
    [Fact]
    public void ReadMapsFileVariablesToConfigurationKeys()
    {
        var folder = Path.Combine(AppContext.BaseDirectory, "TestArtifacts", "FileEnvironmentSecrets");
        Directory.CreateDirectory(folder);
        var clientSecretPath = Path.Combine(folder, Guid.NewGuid().ToString("N"));
        var smtpPasswordPath = Path.Combine(folder, Guid.NewGuid().ToString("N"));
        try
        {
            File.WriteAllText(clientSecretPath, "client-secret\r\n");
            File.WriteAllText(smtpPasswordPath, "smtp-password\n");

            var values = FileEnvironmentSecrets.Read(
            [
                new KeyValuePair<string, string?>("AuthServer__ClientSecret_FILE", clientSecretPath),
                new KeyValuePair<string, string?>("Newsletters__SmtpPassword_FILE", smtpPasswordPath)
            ]);

            Assert.Equal("client-secret", values["AuthServer:ClientSecret"]);
            Assert.Equal("smtp-password", values["Newsletters:SmtpPassword"]);
        }
        finally
        {
            File.Delete(clientSecretPath);
            File.Delete(smtpPasswordPath);
        }
    }

    [Fact]
    public void ReadRejectsUnreadableFilePaths()
    {
        var missingPath = Path.Combine(AppContext.BaseDirectory, Guid.NewGuid().ToString("N"));

        var exception = Assert.Throws<InvalidOperationException>(() => FileEnvironmentSecrets.Read(
        [
            new KeyValuePair<string, string?>("AuthServer__ClientSecret_FILE", missingPath)
        ]));

        Assert.Contains("AuthServer__ClientSecret_FILE", exception.Message, StringComparison.Ordinal);
    }
}
