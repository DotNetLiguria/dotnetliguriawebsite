using DotNetLiguriaCore;

using Microsoft.Extensions.Configuration;

using Xunit;

namespace DotNetLiguriaCore.Tests;

public class MongoApplicationConnectionStringTests
{
    [Fact]
    public void CreateEscapesFileBackedCredentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
            [
                new KeyValuePair<string, string?>("DotNetLiguriaDatabase:DatabaseName", "DotNetLiguria")
            ])
            .Build();
        var fileEnvironmentSecrets = new Dictionary<string, string?>
        {
            ["MONGO_APP_USERNAME"] = "application@user",
            ["MONGO_APP_PASSWORD"] = "p@ss:word/?"
        };

        var connectionString = MongoApplicationConnectionString.Create(fileEnvironmentSecrets, configuration);

        Assert.Equal(
            "mongodb://application%40user:p%40ss%3Aword%2F%3F@mongodb:27017/DotNetLiguria?authSource=DotNetLiguria&tls=false",
            connectionString);
    }

    [Fact]
    public void CreateRejectsPartialApplicationCredentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
            [
                new KeyValuePair<string, string?>("DotNetLiguriaDatabase:DatabaseName", "DotNetLiguria")
            ])
            .Build();
        var fileEnvironmentSecrets = new Dictionary<string, string?>
        {
            ["MONGO_APP_USERNAME"] = "application-user"
        };

        var exception = Assert.Throws<InvalidOperationException>(
            () => MongoApplicationConnectionString.Create(fileEnvironmentSecrets, configuration));

        Assert.Contains("MONGO_APP_PASSWORD_FILE", exception.Message, StringComparison.Ordinal);
    }
}
