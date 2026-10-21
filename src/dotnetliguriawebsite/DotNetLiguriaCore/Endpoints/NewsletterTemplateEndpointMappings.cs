using DotNetLiguriaCore.Services.Newsletters;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DotNetLiguriaCore.Endpoints;

public static class NewsletterTemplateEndpointMappings
{
    private const int _maximumJsonRequestBytes = 256 * 1024;

    public static IEndpointRouteBuilder MapNewsletterTemplateEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/newsletter-templates")
            .RequireAuthorization(new AuthorizeAttribute
            {
                AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme
            })
            .RequireAuthorization("newsletters.read")
            .AddEndpointFilter<NewsletterExceptionFilter>()
            .AddEndpointFilter<NewsletterNoStoreFilter>();

        group.MapGet("/", async (NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ListTemplatesAsync(token)));
        group.MapGet("/placeholders", (NewsletterService service) => Results.Ok(service.Placeholders()));
        group.MapGet("/{id:guid}", async (Guid id, NewsletterService service, CancellationToken token) =>
        {
            var result = await service.GetTemplateAsync(id, token);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });
        group.MapPost("/", async (NewsletterTemplateCreateRequest request, HttpContext context,
            NewsletterService service, CancellationToken token) =>
            Results.Created("/api/newsletter-templates",
                await service.CreateTemplateAsync(request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPut("/{id:guid}", async (Guid id, NewsletterTemplateUpdateRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.UpdateTemplateAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/archive", async (Guid id, NewsletterVersionRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ArchiveTemplateAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/preview", async (Guid id, NewsletterTemplatePreviewRequest request,
            NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.PreviewTemplateAsync(id, request, token)))
            .RequireRateLimiting("newsletter-render")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        return endpoints;
    }
}
