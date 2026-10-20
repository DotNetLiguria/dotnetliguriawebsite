using DotNetLiguriaCore.Services.Access;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Endpoints;

public static class SpeakerAccountEndpointMappings
{
    public static IEndpointRouteBuilder MapSpeakerAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/speaker-accounts")
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<AccessEndpointFilter>();
        group.MapGet("/{id:guid}", async (Guid id, HttpContext context, SpeakerAccountService service, CancellationToken token) =>
            Results.Ok(await service.ReadAsync(context.User, id, token)))
            .RequireAuthorization("speakers.read", "access.users.read");
        group.MapPost("/{id:guid}/link", async (Guid id, SpeakerAccountLinkRequest request,
            HttpContext context, SpeakerAccountService service, CancellationToken token) =>
        {
            await service.LinkAsync(context.User, id, request, context.Request.Headers["X-Confirm-Speaker-Change"], token);
            return Results.NoContent();
        }).RequireAuthorization("speakers.manage", "access.users.read");
        group.MapPost("/{id:guid}/create-and-invite", async (Guid id, SpeakerAccountCreateRequest request,
            HttpContext context, SpeakerAccountService service, CancellationToken token) =>
            Results.Ok(await service.CreateAndInviteAsync(context.User, id, request,
                context.Request.Headers["X-Confirm-Speaker-Change"], token)))
            .RequireAuthorization("speakers.manage", "access.users.read", "access.users.create");
        group.MapPost("/{id:guid}/resend-invitation", async (Guid id, SpeakerAccountLinkRequest request,
            HttpContext context, SpeakerAccountService service, CancellationToken token) =>
            Results.Ok(await service.ResendInvitationAsync(context.User, id, request,
                context.Request.Headers["X-Confirm-Speaker-Change"], token)))
            .RequireAuthorization("speakers.manage", "access.users.read", "access.users.create");
        return endpoints;
    }
}
