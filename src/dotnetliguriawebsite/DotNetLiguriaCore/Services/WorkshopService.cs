using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
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

        public async Task<List<Workshop>> GetAsync(bool onlyPublished = false)
        {
            var publishedWorkshops = await _workshopsCollection
                .Find(x => x.Published == true)
                .SortByDescending(w => w.EventDate)
                .ToListAsync();

            if (onlyPublished)
            {
                return publishedWorkshops;
            }

            var unpublishedWorkshops = await _workshopsCollection
                .Find(x => x.Published == false || x.Published == null)
                .SortByDescending(w => w.EventDate)
                .ToListAsync();

            return publishedWorkshops.Concat(unpublishedWorkshops)
                .OrderByDescending(w => w.EventDate)
                .ToList();
        }

        public async Task<List<Workshop>> GetAllAsync()
        {
            return await _workshopsCollection
            .Find(_ => true)
            .ToListAsync();
        }

        public async Task<List<Workshop>> GetByYearAsync(int year)
        {
            var startDate = new DateTime(year, 1, 1);
            var endDate = new DateTime(year + 1, 1, 1);

            return await _workshopsCollection
                .Find(w => w.Published == true && w.EventDate >= startDate && w.EventDate < endDate)
                .SortByDescending(w => w.EventDate)
                .ToListAsync();
        }

        public async Task<Workshop?> GetAsync(Guid id)
        {
            var returnValue = await FindBBsonIdAsync(id);

            if (returnValue is null)
            {
                return null;
            }

            return returnValue;
        }

        public async Task<Workshop?> GetInHomePageAsync()
        {
            var returnValue = await _workshopsCollection
                .Find(w => w.Published == true && w.In_homepage == true)
                .SortByDescending(w => w.EventDate)
                .FirstOrDefaultAsync();

            if (returnValue is null)
            {
                return null;
            }

            return returnValue;
        }

        public async Task CreateAsync(Workshop newWorkshop) =>
            await _workshopsCollection.InsertOneAsync(newWorkshop);

        public async Task UpdateAsync(Guid id, Workshop updateWorkshop)
        {
            var updatedFields = updateWorkshop.ToBsonDocument();
            updatedFields.Remove("_id");
            var update = new BsonDocumentUpdateDefinition<Workshop>(
                new BsonDocument("$set", updatedFields));
            await _workshopsCollection.UpdateOneAsync(BsonCompatibility.CreateGuidFilter("_id", id), update);
        }

        public async Task UpdateImageAsync(Guid id, string imagePath)
        {
            var filter = BsonCompatibility.CreateGuidFilter("_id", id);
            var update = Builders<Workshop>.Update.Set(x => x.Image, imagePath);
            await _workshopsCollection.UpdateOneAsync(filter, update);
        }

        public async Task RemoveAsync(Guid id) =>
            await _workshopsCollection.DeleteOneAsync(BsonCompatibility.CreateGuidFilter("_id", id));

        public async Task ClearAllHomepageAsync()
        {
            var filter = Builders<Workshop>.Filter.Eq(x => x.In_homepage, true);
            var update = Builders<Workshop>.Update.Set(x => x.In_homepage, false);
            await _workshopsCollection.UpdateManyAsync(filter, update);
        }

        private async Task<Workshop?> FindBBsonIdAsync(Guid workshopId)
        {
            var filter = BsonCompatibility.CreateGuidFilter("_id", workshopId);
            return await _workshopsCollection.Find(filter).FirstOrDefaultAsync();
        }

    }
}
