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

        public async Task<List<WorkshopSpeaker>> GetAsync() =>
            await _workshopSpeakersCollection.Find(_ => true).ToListAsync();

        public async Task<WorkshopSpeaker?> GetAsync(Guid id) =>
            await _workshopSpeakersCollection.Find(x => x.WorkshopSpeakerId == id).FirstOrDefaultAsync();

        public async Task CreateAsync(WorkshopSpeaker newBook) =>
            await _workshopSpeakersCollection.InsertOneAsync(newBook);

        public async Task UpdateAsync(Guid id, WorkshopSpeaker updatedBook) =>
            await _workshopSpeakersCollection.ReplaceOneAsync(x => x.WorkshopSpeakerId == id, updatedBook);

        public async Task RemoveAsync(Guid id) =>
            await _workshopSpeakersCollection.DeleteOneAsync(x => x.WorkshopSpeakerId == id);
    }
}
