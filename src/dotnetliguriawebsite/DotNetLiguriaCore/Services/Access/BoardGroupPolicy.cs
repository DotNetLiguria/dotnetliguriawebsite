using System.Collections.Frozen;

namespace DotNetLiguriaCore.Services.Access;

public static class BoardGroupPolicy
{
    public const string Name = "Board members";
    public static IReadOnlySet<string> Permissions { get; } = new[]
    {
        "events.read", "event-assets.read", "speakers.read", "venues.read",
        "board.read", "site-menu.read", "questionnaires.read", "questionnaire-results.read"
    }.ToFrozenSet(StringComparer.Ordinal);
}
