using DotNetLiguriaCore.Services.Newsletters;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DotNetLiguriaCore.Endpoints;

public static class NewsletterEndpointMappings
{
    private const int _maximumJsonRequestBytes = 256 * 1024;

    public static IEndpointRouteBuilder MapNewsletterEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/newsletters")
            .RequireAuthorization(new AuthorizeAttribute
            {
                AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme
            })
            .RequireAuthorization("newsletters.read")
            .AddEndpointFilter<NewsletterExceptionFilter>()
            .AddEndpointFilter<NewsletterNoStoreFilter>();

        group.MapGet("/config", (NewsletterService service) => Results.Ok(service.Configuration()));
        group.MapGet("/", async (NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ListAsync(token)));
        group.MapGet("/{id:guid}", async (Guid id, NewsletterService service, CancellationToken token) =>
        {
            var result = await service.GetAsync(id, token);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });
        group.MapGet("/events", async (NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.EventsAsync(token)));
        group.MapPost("/", async (NewsletterCreateRequest request, HttpContext context, NewsletterService service,
            CancellationToken token) => Results.Created("/api/newsletters",
                await service.CreateAsync(request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPut("/{id:guid}", async (Guid id, NewsletterUpdateRequest request, HttpContext context,
            NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.UpdateAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/archive", async (Guid id, NewsletterVersionRequest request, HttpContext context,
            NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ArchiveAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/clone", async (Guid id, HttpContext context, NewsletterService service,
            CancellationToken token) => Results.Ok(await service.CloneAsync(id, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write");
        group.MapPost("/{id:guid}/generate", async (Guid id, NewsletterGenerateRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.GenerateAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-render")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/preview", async (Guid id, NewsletterVersionRequest request,
            NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.PreviewAsync(id, request, token)))
            .RequireRateLimiting("newsletter-render");
        group.MapGet("/{id:guid}/snapshots/{snapshotId:guid}", async (Guid id, Guid snapshotId,
            NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.SnapshotAsync(id, snapshotId, token)))
            .RequireRateLimiting("newsletter-render");
        group.MapPost("/{id:guid}/approve", async (Guid id, NewsletterApprovalRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ApproveAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-write")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/images", async (Guid id, IFormFile file, HttpContext context,
            NewsletterService service, CancellationToken token) =>
        {
            await using var stream = file.OpenReadStream();
            return Results.Ok(await service.UploadImageAsync(id, stream, context.User, token));
        })
            .DisableAntiforgery()
            .RequireAuthorization("newsletters.manage")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-upload")
            .WithMetadata(new RequestSizeLimitAttribute(NewsletterImageProcessor.MaximumInputBytes + 64 * 1024));
        group.MapPost("/{id:guid}/test", async (Guid id, NewsletterTestSendRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.TestAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.send")
            .RequireRateLimiting("newsletter-send")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/confirmation", async (Guid id, NewsletterConfirmationRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ConfirmAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.send")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-send")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapPost("/{id:guid}/send", async (Guid id, NewsletterProductionSendRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.SendAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.send")
            .RequireRateLimiting("newsletter-send")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        group.MapGet("/{id:guid}/eml", async (Guid id, Guid snapshotId, string recipient,
            NewsletterService service, CancellationToken token) =>
            Results.File(await service.EmlAsync(id, snapshotId, recipient, token),
                "message/rfc822", "newsletter-test.eml"))
            .RequireRateLimiting("newsletter-render");
        group.MapGet("/{id:guid}/history", async (Guid id, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.HistoryAsync(id, token)));
        group.MapPost("/{id:guid}/reconcile", async (Guid id, NewsletterReconcileRequest request,
            HttpContext context, NewsletterService service, CancellationToken token) =>
            Results.Ok(await service.ReconcileAsync(id, request, context.User, token)))
            .RequireAuthorization("newsletters.send")
            .AddEndpointFilter<ActiveAccountWriteFilter>()
            .RequireRateLimiting("newsletter-send")
            .WithMetadata(new RequestSizeLimitAttribute(_maximumJsonRequestBytes));
        return endpoints;
    }
}
