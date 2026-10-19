using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Questionnaires;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;

namespace DotNetLiguriaCore.Authorization;

public sealed class PermissionOperationFilter : IEndpointFilter
{
    private static readonly PrivacyOperationGate _resourceOperations = new();

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var http = invocation.HttpContext;
        try
        {
            foreach (var argument in invocation.Arguments)
            {
                if (argument is Workshop workshop) workshop.Authorization = null;
                if (argument is Questionnaire questionnaire) questionnaire.Authorization = null;
            }
            var path = (http.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText
                ?? http.Request.Path.Value ?? "";
            path = path.TrimEnd('/');
            var adminRead = http.Request.Headers["X-Admin-Request"] == "true";
            var task = PermissionRoutes.For(path, http.Request.Method);
            using var operation = task is not null &&
                (path.StartsWith("/api/Workshop", StringComparison.Ordinal) ||
                 path.StartsWith("/api/Questionnaire", StringComparison.Ordinal) ||
                 path.StartsWith("/api/Eventbrite", StringComparison.Ordinal))
                ? await _resourceOperations.EnterAsync(http.RequestAborted) : null;
            if (HttpMethods.IsGet(http.Request.Method) &&
                PermissionRoutes.ReadPermission(path) is { } read)
            {
                var auth = await http.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
                if (adminRead && (!auth.Succeeded || auth.Principal is null))
                    return Results.Challenge(authenticationSchemes: [JwtBearerDefaults.AuthenticationScheme]);
                if (auth.Succeeded && auth.Principal is not null) http.User = auth.Principal;
                if (adminRead) await RequireAsync(http, read);
            }
            if (!path.StartsWith("/api/PublicQuestionnaire", StringComparison.Ordinal) &&
                task is { } permission)
                await CheckResourceAsync(invocation, path, permission);
            var result = await next(invocation);
            if (HttpMethods.IsGet(http.Request.Method) &&
                path.StartsWith("/api/Questionnaire", StringComparison.Ordinal) && result is IValueHttpResult questionnaireResult)
                await AddQuestionnaireViewsAsync(http, questionnaireResult.Value);
            if (path.StartsWith("/api/Workshop/", StringComparison.Ordinal) &&
                result is IValueHttpResult value)
            {
                if (value.Value is not Workshop && value.Value is not IEnumerable<Workshop>) return result;
                var workshops = value.Value is Workshop single ? new[] { single }
                    : value.Value is IEnumerable<Workshop> many ? many : [];
                var permissions = await http.RequestServices.GetRequiredService<PermissionEvaluator>()
                    .GetAsync(http.User, http.RequestAborted);
                var configuration = http.RequestServices.GetRequiredService<IConfiguration>();
                var zone = TimeZoneInfo.FindSystemTimeZoneById(configuration["Authorization:EventTimeZoneId"] ?? "Europe/Rome");
                var clock = http.RequestServices.GetRequiredService<TimeProvider>();
                foreach (var workshop in workshops)
                {
                    string? scheduleError = null;
                    bool past;
                    try { past = EventPeriod.IsPast(workshop, clock, zone); }
                    catch (PrivacyBlockedException exception) when (exception.StatusCode == 409)
                    {
                        past = true;
                        scheduleError = exception.Code;
                    }
                    var actions = permissions.Where(id => id.StartsWith("events.", StringComparison.Ordinal) ||
                            id.StartsWith("event-assets.", StringComparison.Ordinal) ||
                            id.StartsWith("eventbrite.", StringComparison.Ordinal) ||
                            id.StartsWith("questionnaire", StringComparison.Ordinal))
                        .Where(id => !past || permissions.Contains("events.past.manage") ||
                            id is "events.read" or "event-assets.read" or "questionnaires.read" or "questionnaire-results.read")
                        .Where(id => workshop.Published != true || permissions.Contains("events.publish") ||
                            id is not ("events.manage" or "event-assets.manage" or "event-assets.delete"))
                        .Order(StringComparer.Ordinal).ToArray();
                    workshop.Authorization = new EventAuthorizationView(past, actions, scheduleError);
                    if (!permissions.Contains("eventbrite.read") || past && !permissions.Contains("events.past.manage"))
                    {
                        workshop.EventbriteEventId = null;
                        workshop.EventbriteEventUrl = null;
                        workshop.EventbriteVenueId = null;
                        workshop.EventbriteTicketClassId = null;
                        workshop.EventbriteLastError = null;
                        workshop.EventbriteSyncStatus = null;
                        workshop.EventbriteLastSyncedAt = null;
                        workshop.EventbriteSyncedTicketCapacity = 0;
                        workshop.EventbritePublished = false;
                    }
                    if (workshop.Published != true && !permissions.Contains("event-assets.read"))
                    {
                        workshop.Materials = [];
                        workshop.Photos = [];
                    }
                }
            }
            return result;
        }
        catch (PrivacyBlockedException exception)
        {
            return Results.Problem(statusCode: exception.StatusCode, title: "Operation not authorized",
                extensions: new Dictionary<string, object?> { ["code"] = exception.Code });
        }
    }

    public static async Task RequireAsync(HttpContext context, string permission)
    {
        var permissions = await context.RequestServices.GetRequiredService<PermissionEvaluator>()
            .GetAsync(context.User, context.RequestAborted);
        if (!permissions.Contains(permission)) throw new PrivacyBlockedException("permission_required", 403);
    }

    private static async Task AddQuestionnaireViewsAsync(HttpContext http, object? value)
    {
        var questionnaires = value is Questionnaire single ? new[] { single }
            : value is IEnumerable<Questionnaire> many ? many : [];
        var summaries = value is IEnumerable<QuestionnaireSummary> list ? list : [];
        if (!questionnaires.Any() && !summaries.Any()) return;
        var permissions = await http.RequestServices.GetRequiredService<PermissionEvaluator>()
            .GetAsync(http.User, http.RequestAborted);
        var configuration = http.RequestServices.GetRequiredService<IConfiguration>();
        var zone = TimeZoneInfo.FindSystemTimeZoneById(configuration["Authorization:EventTimeZoneId"] ?? "Europe/Rome");
        var clock = http.RequestServices.GetRequiredService<TimeProvider>();
        var resources = http.RequestServices.GetRequiredService<IAuthorizationResourceStore>();
        var cache = new Dictionary<Guid, EventAuthorizationView>();
        async Task<EventAuthorizationView> View(Guid? eventId)
        {
            if (eventId is { } cachedId && cache.TryGetValue(cachedId, out var cached)) return cached;
            var past = false;
            string? error = null;
            if (eventId is { } id)
            {
                var workshop = await resources.GetEventAsync(id, http.RequestAborted);
                if (workshop is null) { past = true; error = "event_not_found"; }
                else
                {
                    try { past = EventPeriod.IsPast(workshop, clock, zone); }
                    catch (PrivacyBlockedException exception) when (exception.StatusCode == 409)
                    {
                        past = true;
                        error = exception.Code;
                    }
                }
            }
            var actions = permissions.Where(permission => permission.StartsWith("questionnaire", StringComparison.Ordinal))
                .Where(permission => !past || permissions.Contains("events.past.manage") ||
                    permission is "questionnaires.read" or "questionnaire-results.read")
                .Order(StringComparer.Ordinal).ToArray();
            var view = new EventAuthorizationView(past, actions, error);
            if (eventId is { } key) cache[key] = view;
            return view;
        }
        foreach (var questionnaire in questionnaires) questionnaire.Authorization = await View(questionnaire.WorkshopId);
        foreach (var summary in summaries) summary.Authorization = await View(summary.WorkshopId);
    }

    private static async Task CheckResourceAsync(EndpointFilterInvocationContext invocation, string path, string permission)
    {
        var http = invocation.HttpContext;
        var clock = http.RequestServices.GetRequiredService<TimeProvider>();
        if (permission is "privacy.retention.manage" or "maintenance.speaker-references.repair")
        {
            if (!RecentMfa.IsSatisfied(http.User, clock)) throw new PrivacyBlockedException("recent_mfa_required", 403);
            if (permission == "maintenance.speaker-references.repair")
            {
                if (http.Request.Headers["X-Confirm-Repair"] != "repair-speaker-references")
                    throw new PrivacyBlockedException("explicit_repair_confirmation_required", 400);
                await RequireAsync(http, "events.past.manage");
            }
        }
        if (path.Contains("/PreviewSessionize/", StringComparison.Ordinal))
            await RequireAsync(http, "speakers.read");
        if (path.Contains("/ImportSessionize/", StringComparison.Ordinal))
            await RequireAsync(http, "speakers.manage");

        var relevant = path.StartsWith("/api/Workshop/", StringComparison.Ordinal) ||
            path.StartsWith("/api/WorkshopFile/", StringComparison.Ordinal) ||
            path.StartsWith("/api/Eventbrite/", StringComparison.Ordinal) ||
            path.StartsWith("/api/Questionnaire", StringComparison.Ordinal);
        if (!relevant) return;
        var options = http.RequestServices.GetRequiredService<IConfiguration>();
        var zone = TimeZoneInfo.FindSystemTimeZoneById(options["Authorization:EventTimeZoneId"] ?? "Europe/Rome");
        var resources = http.RequestServices.GetRequiredService<IAuthorizationResourceStore>();
        async Task CheckEvent(Guid? eventId)
        {
            if (eventId is not { } id) return;
            var workshop = await resources.GetEventAsync(id, http.RequestAborted);
            if (workshop is null) throw new PrivacyBlockedException("event_not_found", 404);
            try
            {
                if (EventPeriod.IsPast(workshop, clock, zone))
                    await RequireAsync(http, "events.past.manage");
            }
            catch (PrivacyBlockedException exception) when (exception.StatusCode == 409 &&
                path.StartsWith("/api/Workshop/", StringComparison.Ordinal) &&
                invocation.Arguments.OfType<Workshop>().Any(input => input.EventDate is not null))
            {
                await RequireAsync(http, "events.past.manage");
            }
            if (workshop.Published == true && http.Request.Method != "GET" &&
                path.StartsWith("/api/WorkshopFile/", StringComparison.Ordinal))
                await RequireAsync(http, "events.publish");
        }
        static Guid? RouteId(HttpContext context, string name) =>
            Guid.TryParse(context.Request.RouteValues[name]?.ToString(), out var id) ? id : null;
        if (path.StartsWith("/api/Questionnaire", StringComparison.Ordinal))
        {
            var sensitive = http.Request.Method != "GET" ||
                permission is "questionnaire-responses.read" or "questionnaire-responses.export";
            if (!sensitive) return;
            if (RouteId(http, "id") is { } questionnaireId)
            {
                var questionnaire = await resources.GetQuestionnaireAsync(questionnaireId, http.RequestAborted);
                await CheckEvent(questionnaire?.WorkshopId);
                if (http.Request.Method == "PUT" && questionnaire?.Status == QuestionnaireStatus.Published)
                    await RequireAsync(http, "questionnaires.publish");
            }
            foreach (var argument in invocation.Arguments)
            {
                if (argument is Questionnaire questionnaire) await CheckEvent(questionnaire.WorkshopId);
                if (argument is CreateQuestionnaireRequest create) await CheckEvent(create.WorkshopId);
            }
            return;
        }
        if (http.Request.Method == "GET" && permission != "eventbrite.read") return;
        Guid? id = RouteId(http, "id") ?? RouteId(http, "workshopId");
        if (path.StartsWith("/api/WorkshopFile", StringComparison.Ordinal))
        {
            id = RouteId(http, "workshopId");
            if (RouteId(http, "workshopFileId") is { } fileId)
            {
                id = await resources.GetAssetEventAsync(fileId, http.RequestAborted);
            }
            if (id is null)
            {
                if (http.Request.HasFormContentType)
                {
                    var form = await http.Request.ReadFormAsync(http.RequestAborted);
                    if (Guid.TryParse(form["workshopId"], out var uploadedId)) id = uploadedId;
                }
            }
        }
        if (id is { } existingId) await CheckEvent(existingId);
        if (invocation.Arguments.OfType<Workshop>().FirstOrDefault() is not { } proposed) return;
        var current = id is { } updateId ? await resources.GetEventAsync(updateId, http.RequestAborted) : null;
        if (EventPeriod.IsPast(proposed, clock, zone)) await RequireAsync(http, "events.past.manage");
        foreach (var required in EventChangePermissions.Required(current, proposed))
            await RequireAsync(http, required);
        if (proposed.Published == true && proposed.EventDate is null)
            throw new PrivacyBlockedException("event_date_required", 400);
        if (proposed.In_homepage != (current?.In_homepage ?? false))
        {
            foreach (var selected in await resources.GetHomepageEventsAsync(http.RequestAborted))
                if (EventPeriod.IsPast(selected, clock, zone)) await RequireAsync(http, "events.past.manage");
        }
    }
}
