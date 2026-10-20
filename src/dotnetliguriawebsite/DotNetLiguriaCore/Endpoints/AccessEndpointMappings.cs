using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Endpoints;

public static class AccessEndpointMappings
{
    public static IEndpointRouteBuilder MapAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/admin/access")
            .RequireAuthorization(new AuthorizeAttribute
            {
                AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme
            })
            .AddEndpointFilter<AccessEndpointFilter>();

        group.MapGet("/permissions", async (HttpContext context, AccessManagementService access) =>
        {
            await RequireCatalogAccessAsync(context);
            return Results.Ok(new { permissions = access.Permissions() });
        });

        group.MapGet("/users", async (string? search, int? first, int? max, bool? boardOnly, HttpContext context,
            AccessManagementService access, [FromServices] BoardService boardService, CancellationToken cancellationToken) =>
        {
            await PermissionOperationFilter.RequireAsync(context, "access.users.read");
            var boardEmails = boardOnly == true
                ? (await boardService.GetAsync(onlyActive: true)).Select(member => member.Email).OfType<string>().ToArray()
                : null;
            return Results.Ok(await access.SearchUsersAsync(search ?? "", first ?? 0, max ?? 20, cancellationToken, boardEmails));
        }).RequireAuthorization("access.users.read");

        group.MapGet("/users/{subject}", async (string subject, HttpContext context,
            AccessManagementService access, CancellationToken cancellationToken) =>
        {
            await PermissionOperationFilter.RequireAsync(context, "access.users.read");
            return Results.Ok(await access.GetUserAsync(context.User, subject, cancellationToken));
        }).RequireAuthorization("access.users.read");

        group.MapPost("/users/{subject}/permissions/{permissionId}", async (
            string subject, string permissionId, AccessPermissionChangeRequest request, HttpContext context,
            AccessManagementService access, CancellationToken cancellationToken) =>
        {
            await PermissionOperationFilter.RequireAsync(context, "access.users.read");
            await PermissionOperationFilter.RequireAsync(context, "access.permissions.grant");
            if (request is null || request.ExpectedDirectPermissions is null)
                throw new PrivacyBlockedException("invalid_expected_access_snapshot", StatusCodes.Status400BadRequest);
            var result = await access.ChangePermissionAsync(context.User, subject, permissionId, grant: true,
                request.ExpectedDirectPermissions, context.Request.Headers["X-Confirm-Access-Change"],
                cancellationToken);
            return Results.Ok(result);
        }).RequireAuthorization("access.permissions.grant");

        group.MapDelete("/users/{subject}/permissions/{permissionId}", async (
            string subject, string permissionId, [FromBody] AccessPermissionChangeRequest request, HttpContext context,
            AccessManagementService access, CancellationToken cancellationToken) =>
        {
            await PermissionOperationFilter.RequireAsync(context, "access.users.read");
            await PermissionOperationFilter.RequireAsync(context, "access.permissions.revoke");
            if (request is null || request.ExpectedDirectPermissions is null)
                throw new PrivacyBlockedException("invalid_expected_access_snapshot", StatusCodes.Status400BadRequest);
            var result = await access.ChangePermissionAsync(context.User, subject, permissionId, grant: false,
                request.ExpectedDirectPermissions, context.Request.Headers["X-Confirm-Access-Change"],
                cancellationToken);
            return Results.Ok(result);
        }).RequireAuthorization("access.permissions.revoke");

        group.MapGet("/audit", async (int? first, int? max, HttpContext context,
            AccessManagementService access, CancellationToken cancellationToken) =>
        {
            await PermissionOperationFilter.RequireAsync(context, "access.audit.read");
            return Results.Ok(await access.ReadAuditAsync(first ?? 0, max ?? 50, cancellationToken));
        }).RequireAuthorization("access.audit.read");

        return endpoints;
    }

    private static async Task RequireCatalogAccessAsync(HttpContext context)
    {
        var permissions = await context.RequestServices.GetRequiredService<PermissionEvaluator>()
            .GetAsync(context.User, context.RequestAborted);
        if (!permissions.Contains("access.users.read") &&
            !permissions.Contains("access.permissions.grant") &&
            !permissions.Contains("access.permissions.revoke"))
            throw new PrivacyBlockedException("permission_required", StatusCodes.Status403Forbidden);
    }
}
