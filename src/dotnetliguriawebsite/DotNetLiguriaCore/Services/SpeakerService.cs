using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class SpeakerService
    {
        private readonly IMongoCollection<WorkshopSpeaker> _workshopSpeakersCollection;

        public SpeakerService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);

            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

            _workshopSpeakersCollection = mongoDatabase.GetCollection<WorkshopSpeaker>(mongoDBDatabaseSettings.Value.SpeakerCollectionName);
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

        public async Task CreateAsync(WorkshopSpeaker newBook) =>
            await _workshopSpeakersCollection.InsertOneAsync(newBook);

        public async Task UpdateAsync(Guid id, WorkshopSpeaker updatedBook) =>
            await _workshopSpeakersCollection.ReplaceOneAsync(x => x.WorkshopSpeakerId == id, updatedBook);

        public async Task<List<WorkshopSpeaker>> UpsertSessionizeAsync(IEnumerable<WorkshopSpeaker> importedSpeakers)
        {
            var speakers = new List<WorkshopSpeaker>();
            foreach (var importedSpeaker in importedSpeakers)
            {
                var existingSpeaker = await _workshopSpeakersCollection
                    .Find(x => x.SessionizeId == importedSpeaker.SessionizeId)
                    .FirstOrDefaultAsync();
                if (existingSpeaker is not null)
                {
                    importedSpeaker.WorkshopSpeakerId = existingSpeaker.WorkshopSpeakerId;
                    importedSpeaker.Email = existingSpeaker.Email;
                }

                await _workshopSpeakersCollection.ReplaceOneAsync(
                    x => x.SessionizeId == importedSpeaker.SessionizeId,
                    importedSpeaker,
                    new ReplaceOptions { IsUpsert = true });
                speakers.Add(importedSpeaker);
            }

            return speakers;
        }

        public async Task RemoveAsync(Guid id) =>
            await _workshopSpeakersCollection.DeleteOneAsync(x => x.WorkshopSpeakerId == id);
    }
}
