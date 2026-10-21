using DotNetLiguriaCore.Services.Newsletters;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestOptions : IOptionsMonitor<NewsletterOptions>
{
    public NewsletterOptions CurrentValue { get; set; } = new()
    {
        SenderAddress = "sender@example.test", DefaultTestAddress = "tester@example.test",
        DistributionAddress = "distribution@example.test", SmtpHost = "smtp.example.test",
        TestEnabled = true, ProductionEnabled = true, ActivationGeneration = "generation"
    };
    public NewsletterOptions Get(string? name) => CurrentValue;
    public IDisposable? OnChange(Action<NewsletterOptions, string?> listener) => null;
}
