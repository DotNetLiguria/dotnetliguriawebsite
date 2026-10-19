using System.Collections.Frozen;
using DotNetLiguriaCore.Authorization;

namespace DotNetLiguriaCore.Services.Access;

public static class PermissionDelegationPolicy
{
    private static readonly FrozenSet<string> _delegable = new[]
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
        "backups.read", "backups.create",
        "notifications.preview", "notifications.confirm"
    }.ToFrozenSet(StringComparer.Ordinal);

    public static IReadOnlySet<string> DelegableIds { get; } = _delegable;

    public static bool IsDelegable(string permission) =>
        PermissionCatalog.IsKnown(permission) && _delegable.Contains(permission);
}
