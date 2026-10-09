using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BlazorAppTest.Server;

public sealed class LocalDatabaseHealthCheck : IHealthCheck
{
    private readonly ApplicationDbContexts _context;

    public LocalDatabaseHealthCheck(ApplicationDbContexts context) => _context = context;

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default) =>
        await _context.Database.CanConnectAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("The local SQLite database is unavailable.");
}
