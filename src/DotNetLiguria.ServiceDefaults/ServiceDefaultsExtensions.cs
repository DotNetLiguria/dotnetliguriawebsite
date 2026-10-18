using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace DotNetLiguria.ServiceDefaults;

public static class ServiceDefaultsExtensions
{
    public static IServiceCollection AddServiceDefaults(this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHealthChecks().AddCheck("self", () => HealthCheckResult.Healthy(), ["live"]);
        services.AddOpenTelemetry()
            .WithMetrics(metrics => metrics.AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation().AddRuntimeInstrumentation())
            .WithTracing(tracing => tracing.AddAspNetCoreInstrumentation(options =>
                options.Filter = context => !context.Request.Path.StartsWithSegments("/health")
                    && !context.Request.Path.StartsWithSegments("/alive")
                    && !context.Request.Path.StartsWithSegments("/authentication")
                    && !context.Request.Path.StartsWithSegments("/signin-oidc")
                    && !context.Request.Path.StartsWithSegments("/api/Privacy")
                    && !context.Request.Path.StartsWithSegments("/api/Notifications"))
                .AddHttpClientInstrumentation(options => options.FilterHttpRequestMessage = request =>
                    request.RequestUri is not { } uri ||
                    (!uri.AbsolutePath.Contains("/realms/", StringComparison.Ordinal) &&
                     !uri.AbsolutePath.Contains("/admin/", StringComparison.Ordinal))));

        if (!string.IsNullOrWhiteSpace(configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
        {
            services.AddOpenTelemetry().UseOtlpExporter();
            services.AddLogging(logging => logging.AddOpenTelemetry(options =>
            {
                options.IncludeFormattedMessage = false;
                options.IncludeScopes = false;
            }));
        }
        return services;
    }

    public static void MapServiceDefaults(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/health");
        endpoints.MapHealthChecks("/alive", new()
        {
            Predicate = check => check.Tags.Contains("live")
        });
    }
}
