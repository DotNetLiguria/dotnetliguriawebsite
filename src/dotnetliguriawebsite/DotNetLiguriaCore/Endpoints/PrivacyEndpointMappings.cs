using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
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
        group.MapGet("/status", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(new { status = await coordinator.StatusAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken) }));
        group.MapGet("/export", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, CancellationToken cancellationToken) =>
            Results.Ok(await coordinator.ExportAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken)));
        group.MapPost("/erase", async (HttpContext context, PrivacyCoordinator coordinator,
            IOptions<PrivacyOptions> options, TimeProvider clock, CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, clock))
                return Results.Problem(statusCode: 403, title: "Recent MFA is required", extensions: new Dictionary<string, object?> { ["code"] = "recent_mfa_required" });
            if (context.Request.Headers["X-Confirm-Erasure"] != "erase-my-account")
                return Results.BadRequest(new { code = "explicit_erasure_confirmation_required" });
            await coordinator.EraseAsync(AccountReference.FromPrincipal(context.User, options.Value.Issuer), cancellationToken);
            return Results.Ok(new { status = "completed" });
        });
        var admin = group.MapGroup("/admin").RequireAuthorization("PrivacyAdministrator");
        admin.MapGet("/operations", async (IErasureJournal journal, CancellationToken cancellationToken) =>
            Results.Ok((await journal.ListAsync(cancellationToken)).Select(operation => new { operation.Id, operation.Stage })));
        admin.MapGet("/operations/{id}/report", async (string id, IErasureJournal journal, PrivacyCoordinator coordinator, CancellationToken cancellationToken) =>
        {
            var operation = (await journal.ListAsync(cancellationToken)).SingleOrDefault(item => item.Id == id);
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
            await coordinator.ResumeAsync(id, cancellationToken);
            return Results.Ok(new { status = "completed" });
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
