using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class SpeakerService
    {
        private readonly IMongoCollection<WorkshopSpeaker> _workshopSpeakersCollection;
        private readonly IMongoCollection<Workshop> _workshopsCollection;

        public SpeakerService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);

            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

            _workshopSpeakersCollection = mongoDatabase.GetCollection<WorkshopSpeaker>(mongoDBDatabaseSettings.Value.SpeakerCollectionName);
            _workshopsCollection = mongoDatabase.GetCollection<Workshop>(mongoDBDatabaseSettings.Value.WorkshopCollectionName);
        }

        public async Task<List<WorkshopSpeaker>> GetAsync(bool onlyActive = false)
        {
            var activeSpeakers = await _workshopSpeakersCollection
                .Find(x => x.IsActive == true)
                .ToListAsync();

            if (onlyActive)
            {
                return activeSpeakers;
            }

            var inactiveSpeakers = await _workshopSpeakersCollection
                .Find(x => x.IsActive == false)
                .ToListAsync();

            return activeSpeakers.Concat(inactiveSpeakers).ToList();
        }

        public async Task<WorkshopSpeaker?> GetAsync(Guid id) =>
            await _workshopSpeakersCollection.Find(x => x.WorkshopSpeakerId == id).FirstOrDefaultAsync();

        public async Task<bool> CreateAsync(WorkshopSpeaker newSpeaker)
        {
            newSpeaker.NormalizedName = SpeakerIdentity.NormalizeName(newSpeaker.Name);
            if (string.IsNullOrEmpty(newSpeaker.NormalizedName) || !await IsNameAvailableAsync(newSpeaker.NormalizedName, Guid.Empty))
            {
                return false;
            }

            if (newSpeaker.WorkshopSpeakerId == Guid.Empty)
            {
                newSpeaker.WorkshopSpeakerId = Guid.NewGuid();
            }

            await _workshopSpeakersCollection.InsertOneAsync(newSpeaker);
            return true;
        }

        public async Task<bool> UpdateAsync(Guid id, WorkshopSpeaker updatedSpeaker)
        {
            updatedSpeaker.NormalizedName = SpeakerIdentity.NormalizeName(updatedSpeaker.Name);
            if (string.IsNullOrEmpty(updatedSpeaker.NormalizedName) || !await IsNameAvailableAsync(updatedSpeaker.NormalizedName, id))
            {
                return false;
            }

            await _workshopSpeakersCollection.ReplaceOneAsync(x => x.WorkshopSpeakerId == id, updatedSpeaker);
            return true;
        }

        public async Task<List<SessionizeSpeakerCollision>> GetSessionizeCollisionsAsync(IEnumerable<WorkshopSpeaker> importedSpeakers)
        {
            var existingSpeakers = await _workshopSpeakersCollection.Find(_ => true).ToListAsync();
            return SpeakerImportMatcher.FindCollisions(existingSpeakers, importedSpeakers);
        }

        public async Task<List<WorkshopSpeaker>> UpsertSessionizeAsync(
            IEnumerable<WorkshopSpeaker> importedSpeakers,
            IReadOnlyDictionary<string, bool>? overwriteDecisions = null)
        {
            var speakers = new List<WorkshopSpeaker>();
            var imported = importedSpeakers.ToList();
            var existingSpeakers = await _workshopSpeakersCollection.Find(_ => true).ToListAsync();
            var conflicts = SpeakerImportMatcher.FindCollisions(existingSpeakers, imported);
            if (conflicts.Any(conflict => overwriteDecisions is null || !overwriteDecisions.ContainsKey(conflict.SessionizeId)))
            {
                throw new UnresolvedSpeakerCollisionException();
            }

            foreach (var importedSpeaker in imported)
            {
                var nameKey = SpeakerIdentity.NormalizeName(importedSpeaker.Name);
                var existingById = existingSpeakers.FirstOrDefault(speaker => speaker.SessionizeId == importedSpeaker.SessionizeId);
                var sameName = existingSpeakers
                    .Where(speaker => nameKey.Length > 0 && SpeakerIdentity.NormalizeName(speaker.Name) == nameKey)
                    .ToList();
                var existingSpeaker = existingById ?? sameName.FirstOrDefault();
                var conflict = conflicts.FirstOrDefault(item => item.SessionizeId == importedSpeaker.SessionizeId);
                var overwrite = conflict is null || overwriteDecisions![importedSpeaker.SessionizeId!];

                if (existingSpeaker is not null)
                {
                    var updatedSpeaker = SpeakerIdentity.ApplySessionize(existingSpeaker, importedSpeaker, overwrite);

                    await _workshopSpeakersCollection.ReplaceOneAsync(
                        x => x.WorkshopSpeakerId == existingSpeaker.WorkshopSpeakerId,
                        updatedSpeaker);
                    importedSpeaker.WorkshopSpeakerId = existingSpeaker.WorkshopSpeakerId;
                    importedSpeaker.Email = updatedSpeaker.Email;
                    importedSpeaker.Name = updatedSpeaker.Name;
                    importedSpeaker.ProfileImageUrl = updatedSpeaker.ProfileImageUrl;
                    importedSpeaker.Description = updatedSpeaker.Description;
                    importedSpeaker.IsActive = updatedSpeaker.IsActive;
                    importedSpeaker.NormalizedName = updatedSpeaker.NormalizedName;
                    existingSpeakers.Remove(existingSpeaker);
                    existingSpeakers.Add(updatedSpeaker);
                }
                else
                {
                    if (importedSpeaker.WorkshopSpeakerId == Guid.Empty)
                    {
                        importedSpeaker.WorkshopSpeakerId = Guid.NewGuid();
                    }
                    importedSpeaker.NormalizedName = nameKey;
                    await _workshopSpeakersCollection.InsertOneAsync(importedSpeaker);
                    existingSpeakers.Add(importedSpeaker);
                }

                speakers.Add(importedSpeaker);
            }

            return speakers;
        }

        public async Task<int> ReconcileDuplicatesAsync()
        {
            var existingSpeakers = await _workshopSpeakersCollection.Find(_ => true).ToListAsync();
            var duplicateMap = new Dictionary<Guid, Guid>();
            var canonicalSpeakers = new List<WorkshopSpeaker>();
            var duplicateIds = new List<Guid>();

            foreach (var group in existingSpeakers
                .Where(speaker => !string.IsNullOrEmpty(SpeakerIdentity.NormalizeName(speaker.Name)))
                .GroupBy(speaker => SpeakerIdentity.NormalizeName(speaker.Name)))
            {
                var merged = SpeakerIdentity.Merge(group);
                canonicalSpeakers.Add(merged);
                foreach (var duplicate in group.Where(speaker => speaker.WorkshopSpeakerId != merged.WorkshopSpeakerId))
                {
                    duplicateMap[duplicate.WorkshopSpeakerId] = merged.WorkshopSpeakerId;
                    duplicateIds.Add(duplicate.WorkshopSpeakerId);
                }
            }

            foreach (var speaker in existingSpeakers.Where(speaker => string.IsNullOrEmpty(SpeakerIdentity.NormalizeName(speaker.Name))))
            {
                speaker.NormalizedName = string.Empty;
                canonicalSpeakers.Add(speaker);
            }

            if (duplicateMap.Count > 0)
            {
                var workshops = await _workshopsCollection.Find(_ => true).ToListAsync();
                foreach (var workshop in workshops)
                {
                    if (WorkshopSpeakerReferenceMapper.Repoint(workshop, duplicateMap))
                    {
                        await _workshopsCollection.UpdateOneAsync(
                            workshopItem => workshopItem.WorkshopId == workshop.WorkshopId,
                            Builders<Workshop>.Update
                                .Set(workshopItem => workshopItem.Tracks, workshop.Tracks)
                                .Set(workshopItem => workshopItem.Talks, workshop.Talks));
                    }
                }
            }

            foreach (var speaker in canonicalSpeakers)
            {
                speaker.NormalizedName = SpeakerIdentity.NormalizeName(speaker.Name);
                var update = Builders<WorkshopSpeaker>.Update
                    .Set(item => item.Name, speaker.Name)
                    .Set(item => item.NormalizedName, speaker.NormalizedName)
                    .Set(item => item.SessionizeId, speaker.SessionizeId)
                    .Set(item => item.ProfileImageUrl, speaker.ProfileImageUrl)
                    .Set(item => item.Description, speaker.Description)
                    .Set(item => item.Email, speaker.Email)
                    .Set(item => item.IsActive, speaker.IsActive);
                await _workshopSpeakersCollection.UpdateOneAsync(
                    item => item.WorkshopSpeakerId == speaker.WorkshopSpeakerId,
                    update);
            }

            if (duplicateIds.Count > 0)
            {
                await _workshopSpeakersCollection.DeleteManyAsync(
                    speaker => duplicateIds.Contains(speaker.WorkshopSpeakerId));
            }

            var index = new CreateIndexModel<WorkshopSpeaker>(
                Builders<WorkshopSpeaker>.IndexKeys.Ascending(speaker => speaker.NormalizedName),
                new CreateIndexOptions<WorkshopSpeaker>
                {
                    Name = "uq_speakers_normalized_name",
                    Unique = true,
                    PartialFilterExpression = Builders<WorkshopSpeaker>.Filter.Gt(speaker => speaker.NormalizedName, string.Empty)
                });
            await _workshopSpeakersCollection.Indexes.CreateOneAsync(index);
            return duplicateIds.Count;
        }

        private async Task<bool> IsNameAvailableAsync(string normalizedName, Guid exceptId)
        {
            var speakers = await _workshopSpeakersCollection.Find(_ => true).ToListAsync();
            return speakers.All(speaker =>
                speaker.WorkshopSpeakerId == exceptId ||
                SpeakerIdentity.NormalizeName(speaker.Name) != normalizedName);
        }

        public async Task RemoveAsync(Guid id) =>
            await _workshopSpeakersCollection.DeleteOneAsync(x => x.WorkshopSpeakerId == id);
    }
}
