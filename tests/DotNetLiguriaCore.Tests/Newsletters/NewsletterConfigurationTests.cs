using System.Text.Json;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterConfigurationTests
{
    [Fact]
    public void MissingSmtpExplainsWhyTestsAreDisabledWithoutExposingConfigurationValues()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Options.CurrentValue.SmtpHost = "";
        var configuration = JsonSerializer.SerializeToElement(fixture.Service.Configuration());
        Assert.False(configuration.GetProperty("testEnabled").GetBoolean());
        var reason = configuration.GetProperty("testDisabledReason").GetString();
        Assert.Contains("Newsletters:SmtpHost", reason);
        Assert.DoesNotContain("Newsletters:SenderAddress", reason);
        Assert.False(configuration.TryGetProperty("smtpPassword", out _));
    }

    [Fact]
    public void EmptySenderAddressIsNamedAsTheBlockingSetting()
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Options.CurrentValue.TestEnabled = true;
        fixture.Options.CurrentValue.SenderAddress = "";
        var configuration = JsonSerializer.SerializeToElement(fixture.Service.Configuration());
        Assert.False(configuration.GetProperty("testEnabled").GetBoolean());
        var reason = configuration.GetProperty("testDisabledReason").GetString();
        Assert.Contains("Newsletters:SenderAddress", reason);
        Assert.DoesNotContain("Newsletters:SmtpHost", reason);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void TestReadinessExplainsTheIndependentSwitch(bool enabled)
    {
        var fixture = new NewsletterServiceFixture();
        fixture.Options.CurrentValue.TestEnabled = enabled;
        var configuration = JsonSerializer.SerializeToElement(fixture.Service.Configuration());
        Assert.Equal(enabled, configuration.GetProperty("testEnabled").GetBoolean());
        if (enabled)
            Assert.Equal(JsonValueKind.Null, configuration.GetProperty("testDisabledReason").ValueKind);
        else
            Assert.Contains("Newsletters:TestEnabled", configuration.GetProperty("testDisabledReason").GetString());
    }
}
