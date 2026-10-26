using CommonWeb;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class DotEnvTests
{
    [Fact]
    public void WhitespaceCommentsAndRepeatedAssignmentsAreHandled()
    {
        var key = "DOTNET_LIGURIA_TEST_" + Guid.NewGuid().ToString("N");
        var original = Environment.GetEnvironmentVariable(key);
        var path = TestFilePath();
        try
        {
            File.WriteAllText(path, $"# header\n\n {key} = first # comment\n{key}=second\n");
            DotEnv.Set(path);
            Assert.Equal("second", Environment.GetEnvironmentVariable(key));
        }
        finally
        {
            Environment.SetEnvironmentVariable(key, original);
            File.Delete(path);
        }
    }

    [Theory]
    [InlineData("invalid line")]
    [InlineData("TEST=value=extra")]
    public void MalformedAssignmentsAreRejected(string content)
    {
        var path = TestFilePath();
        try
        {
            File.WriteAllText(path, content);
            Assert.Throws<Exception>(() => DotEnv.Set(path));
        }
        finally
        {
            File.Delete(path);
        }
    }

    private static string TestFilePath()
    {
        var folder = Path.Combine(AppContext.BaseDirectory, "TestArtifacts", "DotEnv");
        Directory.CreateDirectory(folder);
        return Path.Combine(folder, Guid.NewGuid().ToString("N") + ".env");
    }
}
