using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
    public class VenueService
    {
        private readonly IMongoCollection<Venue> _venuesCollection;

        public VenueService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);
            _venuesCollection = mongoDatabase.GetCollection<Venue>(mongoDBDatabaseSettings.Value.VenueCollectionName);
        }

        public async Task<List<Venue>> GetAsync() =>
            await _venuesCollection.Find(_ => true).SortBy(venue => venue.Name).ToListAsync();

        public async Task<Venue?> GetAsync(Guid id) =>
            await _venuesCollection.Find(venue => venue.VenueId == id).FirstOrDefaultAsync();

        public async Task CreateAsync(Venue newVenue) =>
            await _venuesCollection.InsertOneAsync(newVenue);

        public async Task UpdateAsync(Guid id, Venue updatedVenue) =>
            await _venuesCollection.ReplaceOneAsync(venue => venue.VenueId == id, updatedVenue);

        public async Task RemoveAsync(Guid id) =>
            await _venuesCollection.DeleteOneAsync(venue => venue.VenueId == id);
    }
}
