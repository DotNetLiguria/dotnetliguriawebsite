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
			   await _workshopFilesCollection.Find(_ => true).ToListAsync();

		public async Task<List<WorkshopFile>> GetAsync(Guid workshopId)
		{
			return await _workshopFilesCollection.Find(BsonCompatibility.CreateGuidFilter("WorkshopId", workshopId)).ToListAsync();
		}

		public async Task CreateAsync(WorkshopFile newWorkshopFile) =>
			await _workshopFilesCollection.InsertOneAsync(newWorkshopFile);

		public async Task DeleteAsync(Guid workshopFileId) =>
			await _workshopFilesCollection.DeleteOneAsync(BsonCompatibility.CreateGuidFilter("_id", workshopFileId));

	}
}