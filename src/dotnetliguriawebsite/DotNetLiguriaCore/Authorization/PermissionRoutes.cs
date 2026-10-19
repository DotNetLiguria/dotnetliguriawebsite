using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;

namespace DotNetLiguriaCore.Authorization;

public static class PermissionRoutes
{
    public static string? ReadPermission(string path)
    {
        var domain = path.Split('/', StringSplitOptions.RemoveEmptyEntries).Skip(1).FirstOrDefault()?.ToLowerInvariant();
        return domain switch
        {
            "workshop" => "events.read", "workshopfile" => "event-assets.read",
            "speaker" => "speakers.read", "board" => "board.read",
            "venue" => "venues.read", "topmenu" => "site-menu.read",
            "counter" => "maintenance.counters.read", _ => null,
        };
    }

    public static string? For(string route, string method)
    {
        route = route.TrimEnd('/');
        if (route.StartsWith("/api/PublicQuestionnaire/", StringComparison.Ordinal)) return null;
        if (route.StartsWith("/api/Backup/", StringComparison.Ordinal))
            return route.EndsWith("/snapshots", StringComparison.Ordinal) ? "backups.read"
                : route.EndsWith("/export", StringComparison.Ordinal) ? "backups.create" : "backups.restore";
        if (route.StartsWith("/api/Eventbrite/", StringComparison.Ordinal))
            return method == "GET" ? "eventbrite.read"
                : route.Contains("/Publish/", StringComparison.Ordinal) ? "eventbrite.publish" : "eventbrite.manage";
        if (route.StartsWith("/api/Questionnaire", StringComparison.Ordinal))
        {
            if (route.EndsWith("/statistics", StringComparison.Ordinal)) return "questionnaire-results.read";
            if (route.EndsWith("/export", StringComparison.Ordinal)) return "questionnaire-responses.export";
            if (route.Contains("/responses", StringComparison.Ordinal))
                return method == "DELETE" ? "questionnaire-responses.delete" : "questionnaire-responses.read";
            if (method == "GET") return "questionnaires.read";
            if (method == "DELETE") return "questionnaires.delete";
            return route.EndsWith("/publish", StringComparison.Ordinal) || route.EndsWith("/reopen", StringComparison.Ordinal)
                ? "questionnaires.publish" : "questionnaires.manage";
        }
        if (route.StartsWith("/api/privacy/admin/", StringComparison.Ordinal))
        {
            if (route.EndsWith("/identity", StringComparison.Ordinal)) return "privacy.identities.read";
            if (route.EndsWith("/retention", StringComparison.Ordinal))
                return method == "GET" ? "privacy.retention.read" : "privacy.retention.manage";
            if (route.EndsWith("/retry-notification", StringComparison.Ordinal)) return "privacy.notifications.retry";
            return method == "GET" ? "privacy.operations.read" : "privacy.operations.manage";
        }
        if (route.StartsWith("/api/notifications/campaigns/", StringComparison.Ordinal))
            return route.EndsWith("/preview", StringComparison.Ordinal) ? "notifications.preview" : "notifications.confirm";
        if (route.StartsWith("/api/Counter/", StringComparison.Ordinal))
            return method == "GET" ? "maintenance.counters.read" : "maintenance.counters.manage";
        if (method == "GET") return null;
        if (route.StartsWith("/api/Workshop/Publication/", StringComparison.Ordinal)) return "events.publish";
        if (route.StartsWith("/api/Workshop/Homepage/", StringComparison.Ordinal)) return "events.homepage.manage";
        if (route.Contains("/RepairLegacyTrackReferences", StringComparison.Ordinal)) return "maintenance.speaker-references.repair";
        if (route.Contains("/ReconcileDuplicates", StringComparison.Ordinal)) return "speakers.merge";
        if (route.Contains("/PreviewSessionize/", StringComparison.Ordinal)) return "events.read";
        if (route.StartsWith("/api/Values/", StringComparison.Ordinal)) return "maintenance.diagnostics.manage";
        return ReadPermission(route) switch
        {
            "events.read" => method == "DELETE" ? "events.delete" : "events.manage",
            "event-assets.read" => method == "DELETE" ? "event-assets.delete" : "event-assets.manage",
            "speakers.read" => method == "DELETE" ? "speakers.delete" : "speakers.manage",
            "board.read" => method == "DELETE" ? "board.delete" : "board.manage",
            "venues.read" => method == "DELETE" ? "venues.delete" : "venues.manage",
            "site-menu.read" => method == "DELETE" ? "site-menu.delete" : "site-menu.manage",
            "maintenance.counters.read" => "maintenance.counters.manage", _ => null,
        };
    }

    public static T ApplyPermissions<T>(this T builder) where T : IEndpointConventionBuilder
    {
        builder.Finally(endpoint =>
        {
            if (endpoint is not RouteEndpointBuilder route) return;
            var method = endpoint.Metadata.OfType<HttpMethodMetadata>().SingleOrDefault()?.HttpMethods.SingleOrDefault();
            if (method is null) return;
            var permission = For(route.RoutePattern.RawText!, method);
            if (permission is null) return;
            endpoint.Metadata.Add(new AuthorizeAttribute(permission));
        });
        return builder;
    }
}
