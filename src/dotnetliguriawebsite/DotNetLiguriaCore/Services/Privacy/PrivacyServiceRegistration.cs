using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Notifications;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DotNetLiguriaCore.Services.Privacy;

public static class PrivacyServiceRegistration
{
    public static IServiceCollection AddPrivacyServices(this IServiceCollection services,
        IConfiguration configuration, IHostEnvironment environment)
    {
        services.Configure<PrivacyOptions>(configuration.GetSection("Privacy"));
        var options = configuration.GetSection("Privacy").Get<PrivacyOptions>() ?? new PrivacyOptions();
        services.AddDataProtection();
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.TryAddSingleton(PrivacyOperationGate.Shared);
        services.TryAddSingleton<IErasureJournal, FileErasureJournal>();
        services.TryAddSingleton<IRetentionPolicyStore, FileRetentionPolicyStore>();
        services.TryAddSingleton<IAccountPrivacyStore, MongoAccountPrivacyStore>();
        services.TryAddSingleton<DatabaseBackupService>();
        services.TryAddSingleton<IPrivacySnapshotStore>(provider => provider.GetRequiredService<DatabaseBackupService>());
        services.TryAddSingleton<PrivacyCoordinator>();
        services.TryAddSingleton<UnsubscribeTokens>();
        services.TryAddSingleton<INotificationCampaignStore, MongoNotificationCampaignStore>();
        services.TryAddSingleton<NotificationService>();
        services.TryAddSingleton<INotificationRecipientPreparation>(provider => provider.GetRequiredService<NotificationService>());
        services.AddHttpClient<IIdentityAccountAdmin, KeycloakIdentityAccountAdmin>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.MaxResponseContentBufferSize = 2 * 1024 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AllowAutoRedirect = false, UseCookies = false, Credentials = null,
            ActivityHeadersPropagator = null
        }).RemoveAllLoggers();
        services.AddAuthorizationBuilder()
            .AddPolicy("PrivacyAdministrator", policy => policy
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme).RequireAuthenticatedUser()
                .RequireAssertion(context => !string.IsNullOrWhiteSpace(options.AdministratorRole) &&
                    AdminClaimMatcher.IsAuthorized(context.User, options.AdministratorRole, null, options.AuthorizationClientId)))
            .AddPolicy("NotificationAdministrator", policy => policy
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme).RequireAuthenticatedUser()
                .RequireAssertion(context => !string.IsNullOrWhiteSpace(options.NotificationAdministratorRole) &&
                    AdminClaimMatcher.IsAuthorized(context.User, options.NotificationAdministratorRole, null, options.AuthorizationClientId)));
        return services;
    }
}
