using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Newsletters;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Tests.Privacy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterRegistrationTests
{
    [Fact]
    public void ProductionNewsletterGraphResolvesWithoutDatabaseOrSmtpConnections()
    {
        var services = new ServiceCollection();
        var environment = new NewsletterTestEnvironment();
        var configuration = new ConfigurationBuilder().Build();
        var gate = new PrivacyOperationGate();
        var privacy = new PrivacyCoordinator(gate, new MemoryErasureJournal(), new FakeAccountPrivacyStore(),
            new FakeIdentityAccountAdmin(), new FakePrivacySnapshotStore(), Options.Create(new PrivacyOptions()));
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddSingleton<IWebHostEnvironment>(environment);
        services.AddSingleton<IHostEnvironment>(environment);
        services.AddSingleton<TimeProvider>(new NewsletterTestClock());
        services.AddSingleton(gate);
        services.AddSingleton(privacy);
        services.Configure<DotNetLiguriaDatabaseSettings>(options =>
        {
            options.ConnectionString = "mongodb://127.0.0.1:1";
            options.DatabaseName = "never-connect";
            options.WorkshopCollectionName = "Workshops";
        });
        services.AddNewsletterServices(configuration);
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateOnBuild = true, ValidateScopes = true
        });

        Assert.IsType<NewsletterEventSource>(provider.GetRequiredService<INewsletterEventSource>());
        Assert.NotNull(provider.GetRequiredService<NewsletterService>());
        Assert.NotNull(provider.GetRequiredService<INewsletterPrivacyStore>());
        Assert.False(provider.GetRequiredService<IOptionsMonitor<NewsletterOptions>>().CurrentValue.ProductionEnabled);
    }
}
