using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>
/// Rebuilds legacy React submissions from the Mongo Feedback collection. The old endpoint stored
/// one document per rated track with no submission id, so rows are grouped heuristically: same
/// workshop, same note, timestamps within <c>window</c> of the previous row, and no repeated question slot
/// (<c>slotKey</c> maps the synthetic "Tutti" track of every submission to the same slot).
/// </summary>
public static class LegacyFeedbackGrouper
{
    public static (List<List<Feedback>> Groups, int AmbiguousRows) Group(IEnumerable<Feedback> rows, Func<Feedback, string> slotKey, TimeSpan window)
    {
        ArgumentNullException.ThrowIfNull(rows);
        ArgumentNullException.ThrowIfNull(slotKey);
        var groups = new List<List<Feedback>>();
        var ambiguous = 0;

        foreach (var workshopRows in rows.GroupBy(r => r.WorkshopId).OrderBy(g => g.Key))
        {
            var open = new List<List<Feedback>>();
            foreach (var row in workshopRows.OrderBy(r => r.CreatedDate).ThenBy(r => r.FeedbackId))
            {
                var note = NormalizeNote(row.Note);
                var candidates = open
                    .Where(g => NormalizeNote(g[0].Note) == note
                        && row.CreatedDate - g[^1].CreatedDate <= window
                        && g.All(f => slotKey(f) != slotKey(row)))
                    .ToList();

                if (candidates.Count > 1)
                {
                    ambiguous++;
                }

                var target = candidates.OrderByDescending(g => g[^1].CreatedDate).FirstOrDefault();
                if (target is null)
                {
                    target = [];
                    open.Add(target);
                    groups.Add(target);
                }

                target.Add(row);
            }
        }

        return (groups, ambiguous);
    }

    private static string NormalizeNote(string? note) => note?.Trim() ?? string.Empty;
}
