using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DotNetLiguriaCore;

public sealed class MongoDatabaseHealthCheck : IHealthCheck
{
    private readonly IMongoDatabase _database;

    public MongoDatabaseHealthCheck(IOptions<DotNetLiguriaDatabaseSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await _database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1),
                cancellationToken: cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (MongoException)
        {
            return HealthCheckResult.Unhealthy("The configured MongoDB database is unavailable.");
        }
        catch (TimeoutException)
        {
            return HealthCheckResult.Unhealthy("The configured MongoDB database did not respond.");
        }
    }
}
