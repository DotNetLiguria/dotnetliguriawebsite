using DotNetLiguriaCore.Services.Access;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Endpoints;

public static class BoardAccountEndpointMappings
{
    public static IEndpointRouteBuilder MapBoardAccountEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/board-accounts")
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<AccessEndpointFilter>();
        group.MapGet("/{id:guid}", async (Guid id, HttpContext context, BoardAccountService service, CancellationToken token) =>
            Results.Ok(await service.ReadAsync(context.User, id, token))).RequireAuthorization("access.users.read");
        group.MapPost("/{id:guid}/link", async (Guid id, BoardAccountLinkRequest request,
            HttpContext context, BoardAccountService service, CancellationToken token) =>
        {
            await service.LinkAsync(context.User, id, request, context.Request.Headers["X-Confirm-Board-Change"], token);
            return Results.NoContent();
        }).RequireAuthorization("board.manage", "access.users.read");
        group.MapPost("/{id:guid}/membership", async (Guid id, BoardMembershipRequest request,
            HttpContext context, BoardAccountService service, CancellationToken token) =>
            Results.Ok(await service.ChangeMembershipAsync(context.User, id, request,
                context.Request.Headers["X-Confirm-Board-Change"], token))).RequireAuthorization("board.manage");
        return endpoints;
    }
}
