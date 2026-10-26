using System.Text.Json;
using DotNetLiguriaCore.Model;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DataMigration;

/// <summary>One-time repair using an explicitly supplied historical migration export.</summary>
public static class LegacySpeakerReferenceRepair
{
    public static void Run(string[] args)
    {
        var sourcePath = Value(args, "--legacy-workshops")
            ?? throw new ArgumentException("Specify --legacy-workshops <path>.");
        var apply = args.Contains("--apply", StringComparer.OrdinalIgnoreCase);
        var backupPath = Value(args, "--backup-file");
        if (apply && string.IsNullOrWhiteSpace(backupPath))
            throw new ArgumentException("Applying the repair requires --backup-file <new path>.");
        var legacyNames = ParseLegacyNames(File.ReadAllText(sourcePath));
        var settings = ConfigurationReader.Read<DotNetLiguriaDatabaseSettings>("DotNetLiguriaDatabase")
            ?? throw new InvalidOperationException("Database configuration is missing.");
        var database = new MongoClient(settings.ConnectionString).GetDatabase(settings.DatabaseName);
        var speakers = database.GetCollection<WorkshopSpeaker>(settings.SpeakerCollectionName)
            .Find(FilterDefinition<WorkshopSpeaker>.Empty).ToList();
        var canonicalIds = speakers.Where(speaker => !string.IsNullOrWhiteSpace(speaker.Name))
            .GroupBy(speaker => SpeakerIdentity.NormalizeName(speaker.Name))
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single().WorkshopSpeakerId);
        var replacements = legacyNames
            .Where(pair => canonicalIds.ContainsKey(SpeakerIdentity.NormalizeName(pair.Value)))
            .ToDictionary(pair => pair.Key, pair => canonicalIds[SpeakerIdentity.NormalizeName(pair.Value)]);
        var collection = database.GetCollection<Workshop>(settings.WorkshopCollectionName);
        var workshops = collection.Find(FilterDefinition<Workshop>.Empty).ToList();
        var updates = new List<(Workshop Workshop, BsonDocument Original)>();
        var unmapped = 0;
        foreach (var workshop in workshops)
        {
            var references = workshop.Tracks?.SelectMany(track => track.Speakers ?? []).ToArray() ?? [];
            unmapped += references.Count(id => legacyNames.ContainsKey(id) && !replacements.ContainsKey(id));
            var original = workshop.ToBsonDocument();
            if (Repoint(workshop, replacements)) updates.Add((workshop, original));
        }

        Console.WriteLine($"Proposed repair: {updates.Count} workshops; {unmapped} unmapped track references.");
        if (!apply || updates.Count == 0) return;

        // The backup is created before any database write. CreateNew prevents accidental overwrite.
        using (var backup = new FileStream(backupPath!, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        using (var writer = new StreamWriter(backup))
            foreach (var update in updates)
                writer.WriteLine(update.Original.ToJson());

        foreach (var (workshop, _) in updates)
            collection.UpdateOne(item => item.WorkshopId == workshop.WorkshopId,
                Builders<Workshop>.Update.Set(item => item.Tracks, workshop.Tracks).Set(item => item.Talks, workshop.Talks));
        Console.WriteLine($"Repair applied. Original workshop documents saved to {backupPath}.");
    }

    public static IReadOnlyDictionary<Guid, string> ParseLegacyNames(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
            throw new InvalidDataException("Historical workshops must be a JSON array.");
        var names = new Dictionary<Guid, string>();
        foreach (var workshop in document.RootElement.EnumerateArray())
        {
            if (!workshop.TryGetProperty("Tracks", out var tracks) || tracks.ValueKind != JsonValueKind.Array)
                continue;
            foreach (var track in tracks.EnumerateArray())
            {
                if (!track.TryGetProperty("Speakers", out var speakers) || speakers.ValueKind != JsonValueKind.Array)
                    continue;
                foreach (var speaker in speakers.EnumerateArray())
                    if (speaker.TryGetProperty("WorkshopSpeakerId", out var id) && id.TryGetGuid(out var speakerId) &&
                        speaker.TryGetProperty("Name", out var name) && !string.IsNullOrWhiteSpace(name.GetString()))
                        names.TryAdd(speakerId, name.GetString()!);
            }
        }
        return names;
    }

    private static bool Repoint(Workshop workshop, IReadOnlyDictionary<Guid, Guid> replacements)
    {
        var changed = false;
        foreach (var track in workshop.Tracks ?? [])
        {
            if (track.Speakers is null) continue;
            for (var index = 0; index < track.Speakers.Count; index++)
                if (replacements.TryGetValue(track.Speakers[index], out var canonicalId) &&
                    track.Speakers[index] != canonicalId)
                {
                    track.Speakers[index] = canonicalId;
                    changed = true;
                }
        }
        foreach (var talk in workshop.Talks ?? [])
            foreach (var speaker in talk.Speakers)
                if (speaker.WorkshopSpeakerId is { } oldId && replacements.TryGetValue(oldId, out var canonicalId) &&
                    oldId != canonicalId)
                {
                    speaker.WorkshopSpeakerId = canonicalId;
                    changed = true;
                }
        return changed;
    }

    private static string? Value(string[] args, string option)
    {
        var index = Array.FindIndex(args, value => value.Equals(option, StringComparison.OrdinalIgnoreCase));
        return index >= 0 && index + 1 < args.Length && !args[index + 1].StartsWith("--", StringComparison.Ordinal)
            ? args[index + 1] : null;
    }
}
