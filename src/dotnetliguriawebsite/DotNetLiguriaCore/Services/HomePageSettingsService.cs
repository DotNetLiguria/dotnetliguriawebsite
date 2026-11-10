using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class HomePageSettingsService
    {
        public const string CollectionName = "HomePageSettings";

        private readonly IMongoCollection<HomePageSettings> _collection;

        public HomePageSettingsService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);
            _collection = mongoDatabase.GetCollection<HomePageSettings>(CollectionName);
        }

        public async Task<HomePageSettings> GetAsync(CancellationToken cancellationToken = default) =>
            await _collection.Find(x => x.Id == HomePageSettings.SingletonId).FirstOrDefaultAsync(cancellationToken)
                ?? new HomePageSettings();

        public async Task SaveAsync(HomePageSettings settings, CancellationToken cancellationToken = default)
        {
            settings.Id = HomePageSettings.SingletonId;
            await _collection.ReplaceOneAsync(x => x.Id == HomePageSettings.SingletonId, settings,
                new ReplaceOptions { IsUpsert = true }, cancellationToken);
        }
    }
}
