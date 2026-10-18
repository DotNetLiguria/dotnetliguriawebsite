using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public static class PrivacyNoticeServiceRegistration
{
    public static IServiceCollection AddPrivacyAdminNotices(this IServiceCollection services,
        IConfiguration configuration)
    {
        var section = configuration.GetSection("Privacy:Smtp");
        services.AddSingleton<IOptionsChangeTokenSource<PrivacySmtpOptions>>(
            new ConfigurationChangeTokenSource<PrivacySmtpOptions>(section));
        services.AddOptions<PrivacySmtpOptions>().Configure(options =>
        {
            try { section.Bind(options); }
            catch (InvalidOperationException) { options.BindingInvalid = true; }
        });
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.TryAddSingleton<IPrivacySmtpTransport, MailKitPrivacySmtpTransport>();
        services.TryAddSingleton<IAdminPrivacyNoticeSender, AdminPrivacyNoticeSender>();
        services.TryAddSingleton<PrivacyNoticeWorker>();
        services.AddHostedService(provider => provider.GetRequiredService<PrivacyNoticeWorker>());
        services.AddHealthChecks().AddCheck<PrivacySmtpHealthCheck>("privacy_smtp");
        return services;
    }
}
