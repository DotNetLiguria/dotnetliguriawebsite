using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DotNetLiguriaCore.Services.Newsletters;

public static class NewsletterServiceRegistration
{
    public static IServiceCollection AddNewsletterServices(this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddOptions<NewsletterOptions>()
            .Bind(configuration.GetSection(NewsletterOptions.SectionName))
            .Validate(options => options.MaxImageBytes is > 0 and <= NewsletterImageProcessor.MaximumInputBytes,
                "Newsletters:MaxImageBytes must be between 1 and 2097152.")
            .Validate(options => options.MaxMimeBytes is >= 65_536 and <= 10 * 1024 * 1024,
                "Newsletters:MaxMimeBytes must not exceed 10 MiB.")
            .Validate(options => options.MaxImages is > 0 and <= 8,
                "Newsletters:MaxImages must be between 1 and 8.")
            .Validate(options => options.SmtpPort is > 0 and <= 65535 &&
                options.SmtpTimeoutSeconds is >= 5 and <= 120,
                "Newsletters SMTP port or timeout is invalid.")
            .Validate(options => (options.DistributionAliases ?? []).All(NewsletterOptions.IsMailbox),
                "Newsletters:DistributionAliases must contain single mailboxes only.")
            .Validate(options => !options.ProductionEnabled ||
                options.HasSmtpConfiguration && NewsletterOptions.IsMailbox(options.DistributionAddress) &&
                options.IsTestAddressAllowed(options.DefaultTestAddress) &&
                !string.IsNullOrWhiteSpace(options.ActivationGeneration),
                "Production newsletters require SMTP, sender, distribution and activation generation.")
            .ValidateOnStart();
        services.TryAddSingleton<INewsletterStore, MongoNewsletterStore>();
        services.TryAddSingleton<INewsletterSmtpTransport, MailKitNewsletterSmtpTransport>();
        services.TryAddSingleton<INewsletterEventSource, NewsletterEventSource>();
        services.TryAddSingleton<NewsletterTemplateEngine>();
        services.TryAddSingleton<NewsletterRenderer>();
        services.TryAddSingleton<INewsletterRestoreGuard, NewsletterRestoreGuard>();
        services.TryAddSingleton<INewsletterPrivacyStore, NewsletterPrivacyStore>();
        services.TryAddSingleton<NewsletterService>();
        return services;
    }
}
