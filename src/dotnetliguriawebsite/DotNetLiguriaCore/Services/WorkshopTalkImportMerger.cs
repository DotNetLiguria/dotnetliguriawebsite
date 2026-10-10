using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public static class WorkshopTalkImportMerger
{
    public static List<WorkshopTalk> Merge(
        IEnumerable<WorkshopTalk> currentTalks,
        IEnumerable<WorkshopTalk> importedTalks)
    {
        var mergedTalks = currentTalks.ToList();
        foreach (var importedTalk in importedTalks)
        {
            var existingIndex = string.IsNullOrWhiteSpace(importedTalk.SessionizeId)
                ? -1
                : mergedTalks.FindIndex(talk => talk.SessionizeId == importedTalk.SessionizeId);
            if (existingIndex < 0)
            {
                mergedTalks.Add(importedTalk);
            }
            else
            {
                importedTalk.WorkshopTalkId = mergedTalks[existingIndex].WorkshopTalkId;
                importedTalk.TrackId = mergedTalks[existingIndex].TrackId;
                mergedTalks[existingIndex] = importedTalk;
            }
        }

        return mergedTalks;
    }
}
