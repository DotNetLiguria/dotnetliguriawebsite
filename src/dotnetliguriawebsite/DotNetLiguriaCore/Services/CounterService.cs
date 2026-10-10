using DotNetLiguriaCore;
using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace DotNetLiguriaCore.Services
{
	public class CounterService
	{
		private static readonly Guid _workshopCounterId = Guid.Parse("b367b09e-66ef-4a03-ae96-8fbb5bb3a119");
		private readonly IMongoCollection<Counter> _counterCollection;
		private readonly IMongoCollection<Workshop> _workshopsCollection;

		public CounterService(IOptions<DotNetLiguriaDatabaseSettings> mongoDBDatabaseSettings)
		{
			var mongoClient = new MongoClient(mongoDBDatabaseSettings.Value.ConnectionString);
			var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.Value.DatabaseName);

			_counterCollection = mongoDatabase.GetCollection<Counter>(mongoDBDatabaseSettings.Value.CounterCollectionName);
			_workshopsCollection = mongoDatabase.GetCollection<Workshop>(mongoDBDatabaseSettings.Value.WorkshopCollectionName);
		}

		public async Task<List<Counter>> GetAsync() =>
			await _counterCollection.Find(_ => true).ToListAsync();

		public async Task<Counter?> GetAsync(Guid id) =>
			await _counterCollection.Find(x => x.CounterId == id).FirstOrDefaultAsync();

		public async Task<Counter?> GetByNameAsync(string name) =>
			await _counterCollection.Find(x => x.Name!.ToUpper() == name.Trim().ToUpper()).FirstOrDefaultAsync();

		public async Task<Counter> GetOrCreateWorkshopCounterAsync()
		{
			var counter = await GetByNameAsync("Workshop");
			if (counter is not null)
			{
				return counter;
			}

			var workshopFolders = await _workshopsCollection
				.Find(_ => true)
				.Project(workshop => workshop.FolderName)
				.ToListAsync();
			var nextNumber = workshopFolders
				.Select(folderName =>
					folderName is not null &&
					folderName.StartsWith("workshop", StringComparison.OrdinalIgnoreCase) &&
					int.TryParse(folderName.AsSpan("workshop".Length), out var value)
						? value
						: 0)
				.DefaultIfEmpty(0)
				.Max() + 1;
			var initialCounter = new Counter
			{
				CounterId = _workshopCounterId,
				Name = "Workshop",
				Value = nextNumber
			};
			try
			{
				await CreateAsync(initialCounter);
				return initialCounter;
			}
			catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
			{
				counter = await GetByNameAsync("Workshop");
				if (counter is not null)
				{
					return counter;
				}

				throw;
			}
		}

		public async Task<int> ReserveNextWorkshopNumberAsync(Guid counterId)
		{
			var filter = Builders<Counter>.Filter.Eq(counter => counter.CounterId, counterId);
			var initializeNullValue = Builders<Counter>.Filter.Eq(counter => counter.Value, null);
			await _counterCollection.UpdateOneAsync(
				filter & initializeNullValue,
				Builders<Counter>.Update.Set(counter => counter.Value, 1));

			var reservedCounter = await _counterCollection.FindOneAndUpdateAsync(
				filter,
				Builders<Counter>.Update.Inc(counter => counter.Value, 1),
				new FindOneAndUpdateOptions<Counter> { ReturnDocument = ReturnDocument.Before });
			return reservedCounter?.Value
				?? throw new InvalidOperationException("The Workshop counter disappeared while reserving a workshop number.");
		}

		public async Task CreateAsync(Counter newCounter) =>
			await _counterCollection.InsertOneAsync(newCounter);

		public async Task UpdateAsync(Guid id, Counter updatedCounter) =>
			await _counterCollection.ReplaceOneAsync(x => x.CounterId == id, updatedCounter);

	}
}