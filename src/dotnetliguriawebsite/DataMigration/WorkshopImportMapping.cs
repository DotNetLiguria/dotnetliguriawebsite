using System.Text.RegularExpressions;
using DotNetLiguria.Models;

namespace DataMigration;

public static class WorkshopImportMapping
{
    public static void ValidateFolderOwnership(IReadOnlyList<Workshop> source, IReadOnlyList<DotNetLiguria.MongoDBModel.Workshop> existing,
        IReadOnlyDictionary<Guid, string> folders, bool allowFolderMove = false)
    {
        if (source.Any(w => !folders.ContainsKey(w.WorkshopId)) || folders.Values.Distinct(StringComparer.OrdinalIgnoreCase).Count() != folders.Count
            || folders.Values.Any(folder => !Regex.IsMatch(folder, @"\Aworkshop[0-9a-f-]+\z", RegexOptions.IgnoreCase)))
            throw new InvalidOperationException("Every exported workshop requires a unique, safe folder in workshopFolders.json.");
        foreach (var workshop in source)
        {
            var folder = folders[workshop.WorkshopId];
            if (existing.Any(w => string.Equals(w.FolderName, folder, StringComparison.OrdinalIgnoreCase) && w.WorkshopId != workshop.WorkshopId))
                throw new InvalidOperationException($"Import blocked: folder {folder} is owned by another workshop. Resolve asset ownership before importing {workshop.WorkshopId}.");
            if (!allowFolderMove && existing.Any(w => w.WorkshopId == workshop.WorkshopId && !string.IsNullOrEmpty(w.FolderName) && !string.Equals(w.FolderName, folder, StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException($"Import blocked: {workshop.WorkshopId} already has a different folder. A chronological position cannot establish asset ownership.");
        }
    }

    public static void ValidateTracks(IReadOnlyList<Workshop> workshops, IReadOnlyList<WorkshopTrack> tracks)
    {
        var embedded = workshops.SelectMany(w => (w.Tracks ?? []).Select(t => (w.WorkshopId, t.WorkshopTrackId))).ToHashSet();
        var separate = tracks.Select(t => (t.WorkshopId, t.WorkshopTrackId)).ToHashSet();
        if (!embedded.SetEquals(separate) || embedded.Count != tracks.Count)
            throw new InvalidOperationException("Track exports disagree. Re-export all four JSON files together.");
    }

    public static List<DotNetLiguria.MongoDBModel.WorkshopFile> MapFiles(IReadOnlyList<Workshop> workshops, IReadOnlyList<WorkshopFile> files,
        IReadOnlyDictionary<Guid, string> folders, IReadOnlyDictionary<Guid, string>? verifiedFilePaths = null)
    {
        var ordered = workshops.OrderBy(w => w.EventDate).ToList();
        if (ordered.Any(w => w.WorkshopId == Guid.Empty) || ordered.Select(w => w.WorkshopId).Distinct().Count() != ordered.Count)
            throw new InvalidOperationException("Workshop IDs must be nonempty and unique.");
        var mapped = new List<DotNetLiguria.MongoDBModel.WorkshopFile>();
        foreach (var file in files)
        {
            var workshopId = file.Workshop_WorkshopId;
            if (workshopId is null || workshopId == Guid.Empty)
            {
                var match = Regex.Match((file.FullPath ?? "").Replace('\\', '/'), @"/workshops/([0-9a-f-]{36})/", RegexOptions.IgnoreCase);
                if (match.Success && Guid.TryParse(match.Groups[1].Value, out var pathId)) workshopId = pathId;
            }
            var index = ordered.FindIndex(w => w.WorkshopId == workshopId);
            if (index < 0 && !string.IsNullOrEmpty(file.WorkshopFolder))
                index = ordered.FindIndex(w => folders.GetValueOrDefault(w.WorkshopId) == file.WorkshopFolder);
            if (index < 0 || string.IsNullOrWhiteSpace(file.FileName))
                throw new InvalidOperationException($"File {file.WorkshopFileId} has no matching workshop or filename.");
            var folder = folders[ordered[index].WorkshopId];
            var type = file.FileType ?? WorkshopFileType.Other;
            var subfolder = type switch { WorkshopFileType.Material => "tracks", WorkshopFileType.Photo => "photos", _ => "other" };
            var fileId = file.WorkshopFileId is { } id && id != Guid.Empty ? id
                : Questionnaires.DeterministicGuid.Create($"WorkshopFile:{ordered[index].WorkshopId}:{type}:{file.FileName}");
            mapped.Add(new()
            {
                WorkshopFileId = fileId,
                WorkshopId = ordered[index].WorkshopId,
                Title = file.Title,
                FileName = file.FileName,
                FileType = type,
                FullPath = verifiedFilePaths?.GetValueOrDefault(fileId) ?? $"/workshops/{folder}/{subfolder}/{file.FileName}"
            });
        }
        if (mapped.Select(f => f.WorkshopFileId).Distinct().Count() != mapped.Count)
            throw new InvalidOperationException("Duplicate workshop file IDs in export.");
        return mapped;
    }
}
