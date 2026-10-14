using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public static class WorkshopSpeakerReferenceMapper
{
    public static bool Repoint(Workshop workshop, IReadOnlyDictionary<Guid, Guid> canonicalIds)
    {
        var changed = false;
        foreach (var track in workshop.Tracks ?? [])
        {
            if (track.Speakers is null)
            {
                continue;
            }

            for (var index = 0; index < track.Speakers.Count; index++)
            {
                if (canonicalIds.TryGetValue(track.Speakers[index], out var canonicalId))
                {
                    track.Speakers[index] = canonicalId;
                    changed = true;
                }
            }
        }

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
