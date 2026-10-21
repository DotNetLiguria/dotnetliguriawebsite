using Microsoft.AspNetCore.Http.Features;

namespace DotNetLiguriaCore.Security;

public sealed class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment environment)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            headers.XFrameOptions = "SAMEORIGIN";
            if (!environment.IsDevelopment())
            {
                headers.ContentSecurityPolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; " +
                    "script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; " +
                    "font-src 'self'; connect-src 'self' https://hello.vevy.com; " +
                    "frame-src 'self' https://hello.vevy.com; frame-ancestors 'self'; " +
                    "worker-src 'self'; form-action 'self' https://hello.vevy.com";
            }
            if (context.Request.Headers.ContainsKey("Authorization") ||
                context.Request.Path.StartsWithSegments("/authentication") ||
                context.Request.Path.StartsWithSegments("/signin-oidc") ||
                context.Request.Path.StartsWithSegments("/api/Questionnaire") ||
                context.Request.Path.StartsWithSegments("/api/Backup") ||
                context.Request.Path.StartsWithSegments("/api/Privacy") ||
                context.Request.Path.StartsWithSegments("/api/Notifications") ||
                context.Request.Path.StartsWithSegments("/api/newsletters") ||
                context.Request.Path.StartsWithSegments("/api/newsletter-templates"))
            {
                headers.CacheControl = "no-store";
                headers.Pragma = "no-cache";
            }
            return Task.CompletedTask;
        });
        if (context.Request.Path.StartsWithSegments("/api") &&
            context.Request.HasJsonContentType())
        {
            const long maximumBodyBytes = 1024 * 1024;
            if (context.Request.ContentLength > maximumBodyBytes)
                return Results.Problem(statusCode: StatusCodes.Status413PayloadTooLarge,
                    title: "RequestTooLarge").ExecuteAsync(context);
            var bodySize = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (bodySize is { IsReadOnly: false })
                bodySize.MaxRequestBodySize = maximumBodyBytes;
        }
        return next(context);
    }
}
