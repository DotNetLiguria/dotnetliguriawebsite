using System.Text.Json;
using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services;

public sealed class LegacySpeakerReferenceRepairService(
    IOptions<DotNetLiguriaDatabaseSettings> databaseSettings,
    IHostEnvironment environment,
    DatabaseBackupService backupService)
{
    private readonly IMongoCollection<Workshop> _workshops = new MongoClient(databaseSettings.Value.ConnectionString)
        .GetDatabase(databaseSettings.Value.DatabaseName)
        .GetCollection<Workshop>(databaseSettings.Value.WorkshopCollectionName);
    private readonly IMongoCollection<WorkshopSpeaker> _speakers = new MongoClient(databaseSettings.Value.ConnectionString)
        .GetDatabase(databaseSettings.Value.DatabaseName)
        .GetCollection<WorkshopSpeaker>(databaseSettings.Value.SpeakerCollectionName);
    private readonly string _exportPath = Path.Combine(environment.ContentRootPath, "RecoveryData", "workshops.json");
    private readonly DatabaseBackupService _backupService = backupService;

    public async Task<(string? SafetySnapshotId, int WorkshopsUpdated, int ReferencesUpdated, int UnmappedReferences)> RepairAsync(
        CancellationToken cancellationToken)
    {
        var legacyNames = await ReadLegacySpeakerNamesAsync(cancellationToken);
        var currentSpeakers = await _speakers.Find(_ => true).ToListAsync(cancellationToken);
        var canonicalIds = currentSpeakers
            .Where(speaker => !string.IsNullOrWhiteSpace(speaker.Name))
            .GroupBy(speaker => SpeakerIdentity.NormalizeName(speaker.Name))
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single().WorkshopSpeakerId);
        var replacements = legacyNames
            .Where(pair => canonicalIds.TryGetValue(SpeakerIdentity.NormalizeName(pair.Value), out _))
            .ToDictionary(
                pair => pair.Key,
                pair => canonicalIds[SpeakerIdentity.NormalizeName(pair.Value)]);
        var workshops = await _workshops.Find(_ => true).ToListAsync(cancellationToken);
        var updates = new List<(Workshop Workshop, int References)>();
        var unmappedReferences = 0;

        foreach (var workshop in workshops)
        {
            var references = workshop.Tracks?.SelectMany(track => track.Speakers ?? []).ToArray() ?? [];
            unmappedReferences += references.Count(reference => legacyNames.ContainsKey(reference) && !replacements.ContainsKey(reference));
            var before = references.Count(reference => replacements.ContainsKey(reference));
            if (before > 0 && WorkshopSpeakerReferenceMapper.Repoint(workshop, replacements))
            {
                updates.Add((workshop, before));
            }
        }

        if (updates.Count == 0)
        {
            return (null, 0, 0, unmappedReferences);
        }

        var safetySnapshot = await _backupService.CreateAsync(cancellationToken);
        foreach (var (workshop, references) in updates)
        {
            await _workshops.UpdateOneAsync(
                item => item.WorkshopId == workshop.WorkshopId,
                Builders<Workshop>.Update
                    .Set(item => item.Tracks, workshop.Tracks)
                    .Set(item => item.Talks, workshop.Talks),
                cancellationToken: cancellationToken);
        }

        return (safetySnapshot.SnapshotId, updates.Count, updates.Sum(update => update.References), unmappedReferences);
    }

    private async Task<IReadOnlyDictionary<Guid, string>> ReadLegacySpeakerNamesAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_exportPath))
        {
            throw new InvalidDataException($"The recovery export '{_exportPath}' is unavailable.");
        }

        await using var stream = File.OpenRead(_exportPath);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var names = new Dictionary<Guid, string>();
        foreach (var workshop in document.RootElement.EnumerateArray())
        {
            if (!workshop.TryGetProperty("Tracks", out var tracks) || tracks.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var track in tracks.EnumerateArray())
            {
                if (!track.TryGetProperty("Speakers", out var speakers) || speakers.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var speaker in speakers.EnumerateArray())
                {
                    if (speaker.TryGetProperty("WorkshopSpeakerId", out var id) &&
                        speaker.TryGetProperty("Name", out var name) &&
                        id.TryGetGuid(out var speakerId) &&
                        !string.IsNullOrWhiteSpace(name.GetString()))
                    {
                        names.TryAdd(speakerId, name.GetString()!);
                    }
                }
            }
        }

        return names;
    }
}
