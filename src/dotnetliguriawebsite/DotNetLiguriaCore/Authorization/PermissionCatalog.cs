using System.Collections.Frozen;

namespace DotNetLiguriaCore.Authorization;

public static class PermissionCatalog
{
    public static IReadOnlyList<string> Ids { get; } = Array.AsReadOnly(new[]
    {
        "events.read", "events.manage", "events.publish", "events.delete",
        "events.homepage.manage", "events.past.manage",
        "event-assets.read", "event-assets.manage", "event-assets.delete",
        "eventbrite.read", "eventbrite.manage", "eventbrite.publish",
        "speakers.read", "speakers.manage", "speakers.delete", "speakers.merge",
        "venues.read", "venues.manage", "venues.delete",
        "board.read", "board.manage", "board.delete",
        "site-menu.read", "site-menu.manage", "site-menu.delete",
        "questionnaires.read", "questionnaires.manage", "questionnaires.publish", "questionnaires.delete",
        "questionnaire-results.read", "questionnaire-responses.read",
        "questionnaire-responses.export", "questionnaire-responses.delete",
        "backups.read", "backups.create", "backups.restore",
        "maintenance.counters.read", "maintenance.counters.manage",
        "maintenance.speaker-references.repair", "maintenance.diagnostics.manage",
        "privacy.operations.read", "privacy.operations.manage", "privacy.identities.read",
        "privacy.notifications.retry", "privacy.retention.read", "privacy.retention.manage",
        "notifications.preview", "notifications.confirm",
        "newsletters.read", "newsletters.manage", "newsletters.send",
        "access.users.read", "access.users.create", "access.permissions.grant", "access.permissions.revoke", "access.audit.read",
    });

    private static readonly FrozenSet<string> _known = Ids.ToFrozenSet(StringComparer.Ordinal);

    public static bool IsKnown(string permission) => _known.Contains(permission);

    public static bool CanEnterAdmin(IEnumerable<string> permissions) =>
        permissions.Any(permission => IsKnown(permission) && permission != "events.past.manage");
}
