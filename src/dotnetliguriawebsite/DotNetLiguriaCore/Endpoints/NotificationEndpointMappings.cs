using DotNetLiguriaCore.Services.Notifications;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Http.Features;

namespace DotNetLiguriaCore.Endpoints;

public static class NotificationEndpointMappings
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/notifications").AddEndpointFilter<PrivacyEndpointFilter>();
        var account = group.MapGroup("/subscription").RequireAuthorization(
            new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme });
        account.MapGet("/", async (HttpContext context, NotificationService service, IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await service.SubscriptionAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken)));
        account.MapPut("/", async (NotificationSubscriptionRequest request, HttpContext context,
            NotificationService service, IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
        {
            await service.SetSubscriptionAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), request, cancellationToken);
            return Results.NoContent();
        });
        group.MapGet("/unsubscribe/{token}", () => Results.Content(
            """
            <!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
            <meta name="referrer" content="no-referrer"><title>Disiscrizione - DotNetLiguria</title></head>
            <body><main><h1>Disiscrizione dagli avvisi</h1><p>Aprire questo collegamento non modifica il consenso.
            Premi il pulsante per revocare l'iscrizione indicata nel messaggio.</p>
            <form method="post"><button type="submit" name="List-Unsubscribe" value="One-Click">Conferma disiscrizione</button></form>
            </main></body></html>
            """, "text/html; charset=utf-8"))
            .AllowAnonymous();
        group.MapPost("/unsubscribe/{token}", async (string token, HttpContext context,
            NotificationService service, CancellationToken cancellationToken) =>
        {
            if (!context.Request.HasFormContentType || context.Request.ContentLength is > 1024)
                return Results.BadRequest(new { code = "unsubscribe_confirmation_required" });
            if (context.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } bodyLimit)
                bodyLimit.MaxRequestBodySize = 1024;
            var form = await context.Request.ReadFormAsync(cancellationToken);
            if (form.Count != 1 || form["List-Unsubscribe"] != "One-Click")
                return Results.BadRequest(new { code = "unsubscribe_confirmation_required" });
            await service.UnsubscribeAsync(token, cancellationToken);
            return Results.NoContent();
        }).AllowAnonymous().DisableAntiforgery();
        var admin = group.MapGroup("/campaigns").RequireAuthorization("NotificationAdministrator");
        admin.MapPost("/preview", async (NotificationCampaignRequest request, HttpContext context,
            NotificationService service, IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
        {
            var campaign = await service.PreviewAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), request, cancellationToken);
            return Results.Ok(new
            {
                campaign.Id, campaign.Purpose, campaign.EventIds, campaign.RecipientCount, campaign.ExpiresAt,
                status = "preview", dispatchAvailable = false
            });
        });
        admin.MapPost("/{id}/confirm", async (string id, HttpContext context,
            NotificationService service, IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
        {
            if (context.Request.Headers["X-Confirm-Campaign"] != id)
                return Results.BadRequest(new { code = "explicit_campaign_confirmation_required" });
            await service.ConfirmAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), id, cancellationToken);
            return Results.StatusCode(503);
        });
        return endpoints;
    }
}
