using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using System.Globalization;

namespace DotNetLiguriaCore.Endpoints;

public static class PhotoEndpointMappings
{
    public static IEndpointRouteBuilder MapPhotoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var photos = endpoints.MapGroup("/api/photos")
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme })
            .AddEndpointFilter<PrivacyEndpointFilter>();
        MapScope(photos, "/account", "account");
        MapScope(photos, "/board/{id:guid}", "board");
        MapScope(photos, "/speaker/{id:guid}", "speaker");
        endpoints.MapGet("/api/media/photos/{id:guid}/{size:int}", async (Guid id, int size,
            PhotoService service, PrivacyOperationGate gate, HttpContext context) =>
        {
            if (size is not (128 or 512)) return Results.NotFound();
            using var lease = await gate.EnterAsync(context.RequestAborted);
            var bytes = await service.ReadPublicAsync(id, size, context.RequestAborted);
            if (bytes is null) return Results.NotFound();
            context.Response.Headers.CacheControl = "public, max-age=0, must-revalidate";
            context.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.File(bytes, "image/webp", entityTag: new Microsoft.Net.Http.Headers.EntityTagHeaderValue(
                "\"" + PhotoStorage.Hash(bytes) + "\""));
        }).AllowAnonymous().AddEndpointFilter<PrivacyEndpointFilter>();
        return endpoints;
    }

    private static void MapScope(RouteGroupBuilder group, string route, string scope)
    {
        group.MapGet(route, async (HttpContext context, IPhotoStore store, PhotoService service,
            PermissionEvaluator permissions, IOptions<PrivacyOptions> options, PrivacyOperationGate gate, PrivacyCoordinator privacy,
            IIdentityAccountAdmin identities) =>
        {
            using var lease = await gate.EnterAsync(context.RequestAborted);
            var actor = AccountReference.FromPrincipal(context.User, options.Value.Issuer);
            await privacy.EnsureAccountActiveAsync(actor, context.RequestAborted);
            var grants = await permissions.GetAsync(context.User, context.RequestAborted);
            var target = await TargetAsync(scope, context, actor, grants, store, identities);
            return Results.Ok(await service.StatusAsync(target, grants, context.RequestAborted));
        });
        group.MapPost(route + "/select", async (PhotoChangeRequest request, HttpContext context, IPhotoStore store,
            PhotoService service, PermissionEvaluator permissions, IOptions<PrivacyOptions> options,
            PrivacyOperationGate gate, PrivacyCoordinator privacy, PhotoLifecycle lifecycle, PhotoMutationAudit audit,
            IIdentityAccountAdmin identities) =>
        {
            if (!options.Value.ProtectedStorageApproved)
                throw new PrivacyBlockedException("protected_storage_not_approved", 503);
            using var lease = await gate.EnterAsync(context.RequestAborted);
            var actor = AccountReference.FromPrincipal(context.User, options.Value.Issuer);
            await privacy.EnsureAccountActiveAsync(actor, context.RequestAborted);
            var grants = await permissions.GetAsync(context.User, context.RequestAborted);
            var target = await TargetAsync(scope, context, actor, grants, store, identities);
            if (target.Account is not null && target.Account != actor)
                await privacy.EnsureAccountActiveAsync(target.Account, context.RequestAborted);
            await audit.RunAsync(actor, target, "select", async () =>
            {
                await service.ChangeAsync(target, request, grants, context.RequestAborted);
                await lifecycle.CleanupUnreferencedAsync(context.RequestAborted);
            }, context.RequestAborted);
            return Results.Ok(await service.StatusAsync(target, grants, context.RequestAborted));
        }).RequireRateLimiting("api-writes");
        group.MapPost(route + "/upload", async (HttpContext context, IPhotoStore store,
            PhotoService service, PermissionEvaluator permissions, IOptions<PrivacyOptions> options,
            PrivacyOperationGate gate, PrivacyCoordinator privacy, PhotoLifecycle lifecycle, PhotoMutationAudit audit,
            IIdentityAccountAdmin identities) =>
        {
            if (!options.Value.ProtectedStorageApproved)
                throw new PrivacyBlockedException("protected_storage_not_approved", 503);
            var actor = AccountReference.FromPrincipal(context.User, options.Value.Issuer);
            var grants = await permissions.GetAsync(context.User, context.RequestAborted);
            if (scope != "account" && !grants.Contains(scope == "board" ? "board.manage" : "speakers.manage"))
                throw new PrivacyBlockedException("photo_permission_required", 403);
            if (context.Request.ContentLength is > PhotoImageProcessor.MaximumBytes + 64 * 1024)
                throw new PrivacyBlockedException("photo_too_large", 413);
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            var file = form.Files.GetFile("file");
            if (file is null || file.Length is <= 0 or > PhotoImageProcessor.MaximumBytes)
                throw new PrivacyBlockedException("invalid_photo_upload", 400);
            await using var input = file.OpenReadStream();
            using var output = new MemoryStream();
            var buffer = new byte[8192];
            int count;
            while ((count = await input.ReadAsync(buffer, context.RequestAborted)) != 0)
            {
                if (output.Length + count > PhotoImageProcessor.MaximumBytes)
                    throw new PrivacyBlockedException("photo_too_large", 413);
                await output.WriteAsync(buffer.AsMemory(0, count), context.RequestAborted);
            }
            using var lease = await gate.EnterAsync(context.RequestAborted);
            await privacy.EnsureAccountActiveAsync(actor, context.RequestAborted);
            var target = await TargetAsync(scope, context, actor, grants, store, identities);
            if (target.Account is not null && target.Account != actor)
                await privacy.EnsureAccountActiveAsync(target.Account, context.RequestAborted);
            await audit.RunAsync(actor, target, "upload", async () =>
            {
                await service.UploadAsync(target, form["version"].ToString(), output.ToArray(),
                    new PhotoCrop(Number(form["cropX"].ToString()), Number(form["cropY"].ToString()), Number(form["cropSize"].ToString())),
                    context.RequestAborted);
                await lifecycle.CleanupUnreferencedAsync(context.RequestAborted);
            }, context.RequestAborted);
            return Results.Ok(await service.StatusAsync(target, grants, context.RequestAborted));
        }).RequireRateLimiting("api-writes");
        group.MapGet(route + "/image/{size:int}", async (int size, string? existingKey, HttpContext context, IPhotoStore store,
            PhotoService service, PermissionEvaluator permissions, IOptions<PrivacyOptions> options, PrivacyOperationGate gate,
            PrivacyCoordinator privacy, IIdentityAccountAdmin identities) =>
        {
            if (size is not (128 or 512)) return Results.NotFound();
            using var lease = await gate.EnterAsync(context.RequestAborted);
            var actor = AccountReference.FromPrincipal(context.User, options.Value.Issuer);
            await privacy.EnsureAccountActiveAsync(actor, context.RequestAborted);
            var grants = await permissions.GetAsync(context.User, context.RequestAborted);
            var target = await TargetAsync(scope, context, actor, grants, store, identities);
            target = await service.PreviewTargetAsync(target, existingKey, grants, context.RequestAborted);
            var bytes = await service.ReadAsync(target, size, context.RequestAborted);
            return bytes is null ? Results.NotFound() : Results.File(bytes, "image/webp");
        });
    }
    private static float Number(string value) => float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
        ? number : throw new PrivacyBlockedException("invalid_photo_crop", 400);
    private static async Task<PhotoTarget> TargetAsync(string scope, HttpContext context, AccountReference actor,
        IReadOnlySet<string> grants, IPhotoStore store, IIdentityAccountAdmin identities)
    {
        if (scope == "account")
        {
            var target = MongoPhotoStore.AccountTarget(actor);
            if (!PermissionCatalog.CanEnterAdmin(grants) || !grants.Contains("board.read") && !grants.Contains("speakers.read"))
                return target;
            var identity = await identities.GetAsync(actor, context.RequestAborted)
                ?? throw new PrivacyBlockedException("identity_account_unavailable", 503);
            return target with { Name = $"{identity.FirstName} {identity.LastName}".Trim(), Email = identity.Email };
        }
        if (!grants.Contains(scope == "board" ? "board.manage" : "speakers.manage"))
            throw new PrivacyBlockedException("photo_permission_required", 403);
        var id = Guid.Parse(context.Request.RouteValues["id"]!.ToString()!);
        return await store.TargetAsync($"{scope}:{id:D}", context.RequestAborted)
            ?? throw new PrivacyBlockedException("photo_profile_not_found", 404);
    }
}
