using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Endpoints;

public static class PrivacyEndpointMappings
{
    public static IEndpointRouteBuilder MapPrivacyEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/privacy")
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<PrivacyEndpointFilter>();
        group.MapGet("/profile", async (HttpContext context, KeycloakProfileClient profiles,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await profiles.GetAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer),
                await context.GetTokenAsync(JwtBearerDefaults.AuthenticationScheme, "access_token"), cancellationToken)));
        group.MapPut("/profile", async (PersonalIdentityUpdate update, HttpContext context, KeycloakProfileClient profiles,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await profiles.UpdateAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer),
                await context.GetTokenAsync(JwtBearerDefaults.AuthenticationScheme, "access_token"), update, cancellationToken)));
        group.MapGet("/status", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(new { status = await coordinator.StatusAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken) }));
        group.MapGet("/export", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await coordinator.ExportAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken)));
        group.MapGet("/data", async (int? offset, HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await coordinator.DataAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), offset ?? 0, cancellationToken)));
        group.MapPost("/erase", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock))
                return Results.Problem(statusCode: 403, title: "Recent MFA is required", extensions: new Dictionary<string, object?> { ["code"] = "recent_mfa_required" });
            if (context.Request.Headers["X-Confirm-Erasure"] != "erase-my-account")
                return Results.BadRequest(new { code = "explicit_erasure_confirmation_required" });
            var status = await coordinator.EraseAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken);
            return Results.Json(new { status }, statusCode: status == "completed" ? 200 : 202);
        });
        var admin = group.MapGroup("/admin").RequireAuthorization("PrivacyAdministrator");
        admin.MapGet("/operations", async (PrivacyCoordinator coordinator, CancellationToken cancellationToken) =>
            Results.Ok((await coordinator.OperationsAsync(cancellationToken)).Select(operation => new
            {
                operation.Id, operation.Stage, notificationStatus = operation.NoticeStatus,
                notificationAttempts = operation.NoticeAttempts, notificationError = operation.NoticeErrorCode
            })));
        admin.MapGet("/operations/{id}/identity", async (string id, HttpContext context,
            PrivacyCoordinator coordinator, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock))
                return Results.Problem(statusCode: 403, extensions: new Dictionary<string, object?> { ["code"] = "recent_mfa_required" });
            return Results.Ok(await coordinator.IdentityForOperationAsync(id, cancellationToken));
        });
        admin.MapPost("/operations/{id}/verify-removal", async (string id, HttpContext context,
            PrivacyCoordinator coordinator, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock))
                return Results.Problem(statusCode: 403, extensions: new Dictionary<string, object?> { ["code"] = "recent_mfa_required" });
            if (context.Request.Headers["X-Confirm-Erasure"] != "verify-identity-removal")
                return Results.BadRequest(new { code = "explicit_erasure_confirmation_required" });
            await coordinator.VerifyIdentityRemovalAsync(id, cancellationToken);
            return Results.Ok(new { status = "completed" });
        });
        admin.MapPost("/operations/{id}/retry-notification", async (string id, HttpContext context,
            PrivacyCoordinator coordinator, CancellationToken cancellationToken) =>
        {
            if (context.Request.Headers["X-Confirm-Erasure"] != "retry-notification")
                return Results.BadRequest(new { code = "explicit_erasure_confirmation_required" });
            await coordinator.RetryNotificationAsync(id, cancellationToken);
            return Results.Json(new { status = "queued" }, statusCode: 202);
        });
        admin.MapGet("/operations/{id}/report", async (string id, PrivacyCoordinator coordinator, CancellationToken cancellationToken) =>
        {
            var operation = (await coordinator.OperationsAsync(cancellationToken)).SingleOrDefault(item => item.Id == id);
            return operation is null ? Results.NotFound() :
                Results.Ok(new { operation.Id, operation.Stage, retainedFields = await coordinator.InspectAsync(operation.Account, cancellationToken) });
        });
        admin.MapGet("/retention", async (IRetentionPolicyStore policies, CancellationToken cancellationToken) =>
        {
            var overrides = await policies.ReadAsync(cancellationToken);
            return Results.Ok(new
            {
                version = ErasureFieldInventory.Version,
                defaultAction = "delete-whole-unassessed-record",
                fields = ErasureFieldInventory.DeletableFields, overrides,
                blockingOverrides = ErasureFieldInventory.BlockingOverrides(new PrivacyOptions { RetentionOverrides = overrides })
            });
        });
        admin.MapPut("/retention", async (Dictionary<string, string> overrides, HttpContext context,
            IRetentionPolicyStore policies, CancellationToken cancellationToken) =>
        {
            if (context.Request.Headers["X-Confirm-Retention-Policy"] != "replace")
                return Results.BadRequest(new { code = "explicit_policy_confirmation_required" });
            await policies.ReplaceAsync(overrides, cancellationToken);
            return Results.Ok(new { blockingOverrides = ErasureFieldInventory.BlockingOverrides(new PrivacyOptions { RetentionOverrides = overrides }) });
        });
        admin.MapPost("/operations/{id}/resume", async (string id, HttpContext context,
            PrivacyCoordinator coordinator, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock)) return Results.StatusCode(403);
            if (context.Request.Headers["X-Confirm-Erasure"] != "resume-erasure") return Results.BadRequest();
            var status = await coordinator.ResumeAsync(id, cancellationToken);
            return Results.Json(new { status }, statusCode: status == "completed" ? 200 : 202);
        });
        admin.MapPost("/reconcile-deleted-identity", async (AccountReference account, HttpContext context,
            PrivacyCoordinator coordinator, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock)) return Results.StatusCode(403);
            if (context.Request.Headers["X-Confirm-Erasure"] != "reconcile-deleted-account") return Results.BadRequest();
            await coordinator.ReconcileDeletedIdentityAsync(account, cancellationToken);
            return Results.Ok(new { status = "completed" });
        });
        return endpoints;
    }
}
