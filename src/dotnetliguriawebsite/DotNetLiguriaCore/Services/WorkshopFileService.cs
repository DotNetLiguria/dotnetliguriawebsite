using DotNetLiguriaCore;
using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
	public class WorkshopFileService
	{
		private readonly IMongoCollection<WorkshopFile> _workshopFilesCollection;

		public WorkshopFileService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
		{
			var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
			var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);
			_workshopFilesCollection = mongoDatabase.GetCollection<WorkshopFile>(mongoDBDatabaseSettings.Value.WorkshopFileCollectionName);
		}

		public async Task<List<WorkshopFile>> GetAsync() =>
			   await _workshopFilesCollection.Find(_ => true).ReadBoundedAsync();

		public async Task<List<WorkshopFile>> GetAsync(Guid workshopId)
		{
			return await _workshopFilesCollection.Find(BsonCompatibility.CreateGuidFilter("WorkshopId", workshopId)).ReadBoundedAsync();
		}

		public async Task<WorkshopFile?> GetFileAsync(Guid workshopFileId) =>
			await _workshopFilesCollection.Find(BsonCompatibility.CreateGuidFilter("_id", workshopFileId)).FirstOrDefaultAsync();

		public async Task<List<WorkshopFile>> GetForWorkshopsAsync(IEnumerable<Guid> workshopIds)
		{
			var filters = workshopIds.Distinct().Select(id => new BsonDocumentFilterDefinition<WorkshopFile>(
				BsonCompatibility.CreateGuidFilter("WorkshopId", id))).ToList();
			if (filters.Count == 0) return [];
			return await _workshopFilesCollection.Find(Builders<WorkshopFile>.Filter.Or(filters)).ReadBoundedAsync();
		}

		public async Task CreateAsync(WorkshopFile newWorkshopFile) =>
			await _workshopFilesCollection.InsertOneAsync(newWorkshopFile);

		public async Task DeleteAsync(Guid workshopFileId) =>
			await _workshopFilesCollection.DeleteOneAsync(BsonCompatibility.CreateGuidFilter("_id", workshopFileId));

	}
}