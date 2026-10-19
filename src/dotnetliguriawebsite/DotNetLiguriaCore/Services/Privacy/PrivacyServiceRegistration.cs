using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Notifications;
using DotNetLiguriaCore.Services.Privacy.Notices;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DotNetLiguriaCore.Services.Privacy;

public static class PrivacyServiceRegistration
{
    public static IServiceCollection AddPrivacyServices(this IServiceCollection services,
        IConfiguration configuration, IHostEnvironment environment)
    {
        services.Configure<PrivacyOptions>(configuration.GetSection("Privacy"));
        services.AddPrivacyAdminNotices(configuration);
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
        services.TryAddSingleton<IConsentHistoryStore, MongoConsentHistoryStore>();
        services.TryAddSingleton<INotificationRecipientPreparation>(provider => provider.GetRequiredService<NotificationService>());
        services.AddHttpClient<KeycloakProfileClient>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.MaxResponseContentBufferSize = 256 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AllowAutoRedirect = false, UseCookies = false, Credentials = null,
            ActivityHeadersPropagator = null
        }).RemoveAllLoggers();
        services.AddHttpClient<KeycloakActiveAccountVerifier>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(10);
            client.MaxResponseContentBufferSize = 64 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AllowAutoRedirect = false, UseCookies = false, Credentials = null,
            ActivityHeadersPropagator = null
        }).RemoveAllLoggers();
        services.AddHttpClient<IIdentityAccountAdmin, KeycloakIdentityAccountAdmin>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.MaxResponseContentBufferSize = 2 * 1024 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AllowAutoRedirect = false, UseCookies = false, Credentials = null,
            ActivityHeadersPropagator = null
        }).RemoveAllLoggers();
        services.AddPermissionAuthorization();
        return services;
    }
}
