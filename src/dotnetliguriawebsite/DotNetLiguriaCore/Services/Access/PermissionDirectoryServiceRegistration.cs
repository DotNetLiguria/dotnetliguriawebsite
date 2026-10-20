using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DotNetLiguriaCore.Services.Access;

public static class PermissionDirectoryServiceRegistration
{
    public static IServiceCollection AddPermissionDirectory(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<PermissionDirectoryOptions>(configuration.GetSection("PermissionDirectory"));
        var privacyAdminClientId = configuration["Privacy:AdminClientId"];
        var privacyAdminSecret = configuration["Privacy:AdminClientSecret"];
        services.PostConfigure<PermissionDirectoryOptions>(options =>
        {
            options.PrivacyAdminClientId = privacyAdminClientId ?? "";
            options.PrivacyAdminClientSecret = privacyAdminSecret ?? "";
        });
        services.AddHttpClient("PermissionDirectory", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.MaxResponseContentBufferSize = 256 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseCookies = false,
            Credentials = null,
            ActivityHeadersPropagator = null
        }).RemoveAllLoggers();
        services.AddScoped<KeycloakPermissionDirectory>(provider => new KeycloakPermissionDirectory(
            provider.GetRequiredService<IHttpClientFactory>().CreateClient("PermissionDirectory"),
            provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<PermissionDirectoryOptions>>()));
        services.AddScoped<IAccessPermissionDirectory>(provider =>
            provider.GetRequiredService<KeycloakPermissionDirectory>());
        services.AddScoped<IPermissionDirectory>(provider =>
            provider.GetRequiredService<IAccessPermissionDirectory>());
        services.TryAddSingleton<IAccessAuditStore, MongoAccessAuditStore>();
        services.TryAddSingleton<TimeProvider>(TimeProvider.System);
        services.AddScoped<AccessEndpointFilter>();
        services.AddScoped<AccessManagementService>();
        services.AddScoped<IBoardAccountStore>(provider => provider.GetRequiredService<BoardService>());
        services.AddScoped<BoardAccountService>();
        services.AddScoped<ISpeakerOnboardingDirectory>(provider => provider.GetRequiredService<KeycloakPermissionDirectory>());
        services.AddScoped<ISpeakerAccountStore, MongoSpeakerAccountStore>();
        services.AddScoped<SpeakerAccountService>();
        return services;
    }
}
