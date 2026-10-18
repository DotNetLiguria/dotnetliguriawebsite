using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class TopMenuService
    {
        private readonly IMongoCollection<TopMenu> _topMenuCollection;

        public TopMenuService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

            _topMenuCollection = mongoDatabase.GetCollection<TopMenu>(mongoDBDatabaseSettings.Value.TopMenuCollectionName);
        }

        public async Task<List<TopMenu>> GetAsync(bool onlyActive = false)
        {
            var activeElements = await _topMenuCollection
                .Find(x => x.IsActive == true)
                .SortBy(x => x.Order)
                .ReadBoundedAsync();

            if (onlyActive)
            {
                return activeElements;
            }

            var inactiveElements = await _topMenuCollection
                .Find(x => x.IsActive == false)
                .ReadBoundedAsync();

            return activeElements.Concat(inactiveElements).ToList();
        }

        public async Task<TopMenu?> GetAsync(Guid id) =>
            await _topMenuCollection.Find(x => x.TopMenuElementId == id).FirstOrDefaultAsync();

        public async Task CreateAsync(TopMenu newTopMenuElement) =>
            await _topMenuCollection.InsertOneAsync(newTopMenuElement);

        public async Task UpdateAsync(Guid id, TopMenu updatedTopMenuElement) =>
            await _topMenuCollection.ReplaceOneAsync(x => x.TopMenuElementId == id, updatedTopMenuElement);

        public async Task RemoveAsync(Guid id) =>
            await _topMenuCollection.DeleteOneAsync(x => x.TopMenuElementId == id);
    }
}
