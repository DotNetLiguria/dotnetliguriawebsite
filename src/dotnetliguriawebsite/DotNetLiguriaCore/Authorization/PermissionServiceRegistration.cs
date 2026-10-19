using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DotNetLiguriaCore.Authorization;

public static class PermissionServiceRegistration
{
    public static IServiceCollection AddPermissionAuthorization(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.TryAddScoped<PermissionEvaluator>();
        services.TryAddScoped<IAuthorizationResourceStore, AuthorizationResourceStore>();
        services.TryAddEnumerable(ServiceDescriptor.Scoped<IAuthorizationHandler, PermissionHandler>());
        services.TryAddSingleton<IAuthorizationMiddlewareResultHandler, PermissionAuthorizationResultHandler>();
        services.AddAuthorization(options =>
        {
            foreach (var permission in PermissionCatalog.Ids)
                options.AddPolicy(permission, policy => policy
                    .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
                    .RequireAuthenticatedUser().AddRequirements(new PermissionRequirement(permission)));
        });
        return services;
    }
}
