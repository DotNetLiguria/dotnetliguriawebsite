using DotNetLiguriaCore.Services.Newsletters;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterOptionsTests
{
    [Theory]
    [InlineData("editor@example.test", true)]
    [InlineData("editor+events@example.test", true)]
    [InlineData("editor@example.test,other@example.test", false)]
    [InlineData("editor@example.test\r\nBcc:other@example.test", false)]
    [InlineData("\teditor@example.test", false)]
    [InlineData("editor@example.test\0", false)]
    [InlineData("Editor Name <editor@example.test>", false)]
    [InlineData("", false)]
    public void AcceptsExactlyOneMailboxWithoutHeaderSyntax(string value, bool expected)
    {
        Assert.Equal(expected, NewsletterOptions.IsMailbox(value));
    }

    [Theory]
    [InlineData(true, MailKit.Security.SecureSocketOptions.StartTls)]
    [InlineData(false, MailKit.Security.SecureSocketOptions.None)]
    public void SmtpUseStartTlsFalseMeansPlainSmtpWithoutTls(bool useStartTls,
        MailKit.Security.SecureSocketOptions expected)
    {
        Assert.Equal(expected, MailKitNewsletterSmtpTransport.ToSocketOptions(useStartTls));
    }

    [Fact]
    public void RejectsDistributionAddressAndItsAliasesAsTestDestinations()
    {
        var options = new NewsletterOptions
        {
            DistributionAddress = "list@example.test",
            DistributionAliases = ["subscribers@example.test"]
        };

        Assert.False(options.IsTestAddressAllowed("list@example.test"));
        Assert.False(options.IsTestAddressAllowed("SUBSCRIBERS@example.test"));
        Assert.True(options.IsTestAddressAllowed("editor@example.test"));
    }

    [Theory]
    [InlineData("smtp.example.test", "reply@example.test", "DotNetLiguria", true)]
    [InlineData("smtp.example.test\n", "", "DotNetLiguria", false)]
    [InlineData("smtp.example.test", "not a mailbox", "DotNetLiguria", false)]
    [InlineData("smtp.example.test", "", "Sender\r\nBcc:other@example.test", false)]
    public void RequiresSafeSmtpAndHeaderConfiguration(string host, string replyTo, string name, bool expected)
    {
        var options = new NewsletterOptions
        {
            SmtpHost = host, SenderAddress = "sender@example.test", ReplyToAddress = replyTo,
            SenderName = name
        };
        Assert.Equal(expected, options.HasSmtpConfiguration);
    }
}
