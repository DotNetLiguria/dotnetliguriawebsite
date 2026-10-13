using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public static class WorkshopSpeakerReferenceMapper
{
    public static bool Repoint(Workshop workshop, IReadOnlyDictionary<Guid, Guid> canonicalIds)
    {
        var changed = false;
        foreach (var talk in workshop.Talks ?? [])
        {
            foreach (var speaker in talk.Speakers)
            {
                if (speaker.WorkshopSpeakerId is { } oldId &&
                    canonicalIds.TryGetValue(oldId, out var canonicalId))
                {
                    speaker.WorkshopSpeakerId = canonicalId;
                    changed = true;
                }
            }
        }

        return changed;
    }
}
