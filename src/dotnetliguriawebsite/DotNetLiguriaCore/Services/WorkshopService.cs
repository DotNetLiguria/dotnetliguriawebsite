using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class WorkshopService
    {
        private readonly IMongoCollection<Workshop> _workshopsCollection;

        public WorkshopService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);

            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

            _workshopsCollection = mongoDatabase.GetCollection<Workshop>(mongoDBDatabaseSettings.Value.WorkshopCollectionName);
        }

        public async Task<List<Workshop>> GetAsync() =>
            await _workshopsCollection.Find(_ => true).ToListAsync();

        public async Task<Workshop?> GetAsync(Guid id) =>
            await _workshopsCollection.Find(x => x.WorkshopId == id).FirstOrDefaultAsync();

        public async Task CreateAsync(Workshop newBook) =>
            await _workshopsCollection.InsertOneAsync(newBook);

        public async Task UpdateAsync(Guid id, Workshop updatedBook) =>
            await _workshopsCollection.ReplaceOneAsync(x => x.WorkshopId == id, updatedBook);

        public async Task RemoveAsync(Guid id) =>
            await _workshopsCollection.DeleteOneAsync(x => x.WorkshopId == id);
    }
}
