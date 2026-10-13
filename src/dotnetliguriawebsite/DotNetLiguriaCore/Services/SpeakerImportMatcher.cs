using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public static class SpeakerImportMatcher
{
    public static List<SessionizeSpeakerCollision> FindCollisions(
        IReadOnlyCollection<WorkshopSpeaker> existingSpeakers,
        IEnumerable<WorkshopSpeaker> importedSpeakers)
    {
        var collisions = new List<SessionizeSpeakerCollision>();
        var importedByName = new Dictionary<string, WorkshopSpeaker>(StringComparer.Ordinal);
        foreach (var imported in importedSpeakers)
        {
            var normalizedName = SpeakerIdentity.NormalizeName(imported.Name);
            var bySessionizeId = existingSpeakers.FirstOrDefault(speaker => speaker.SessionizeId == imported.SessionizeId);
            var sameName = existingSpeakers.FirstOrDefault(speaker =>
                normalizedName.Length > 0 && SpeakerIdentity.NormalizeName(speaker.Name) == normalizedName);
            importedByName.TryGetValue(normalizedName, out var priorImport);
            var existingConflict = sameName is not null &&
                (bySessionizeId is null || bySessionizeId.WorkshopSpeakerId != sameName.WorkshopSpeakerId);
            var importedConflict = priorImport is not null && priorImport.SessionizeId != imported.SessionizeId;
            if (normalizedName.Length == 0 || (!existingConflict && !importedConflict))
            {
                if (normalizedName.Length > 0)
                {
                    importedByName.TryAdd(normalizedName, imported);
                }
                continue;
            }

            var collisionTarget = sameName ?? priorImport ?? bySessionizeId!;
            collisions.Add(new SessionizeSpeakerCollision
            {
                SessionizeId = imported.SessionizeId ?? string.Empty,
                ImportedName = imported.Name,
                ExistingSpeakerId = collisionTarget.WorkshopSpeakerId,
                ExistingName = collisionTarget.Name
            });
            importedByName.TryAdd(normalizedName, imported);
        }

        return collisions;
    }
}
