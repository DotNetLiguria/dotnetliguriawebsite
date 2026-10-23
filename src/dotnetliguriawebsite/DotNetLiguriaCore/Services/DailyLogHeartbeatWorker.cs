namespace DotNetLiguriaCore.Services;

public sealed class DailyLogHeartbeatWorker(
    ILogger<DailyLogHeartbeatWorker> logger,
    TimeProvider timeProvider) : BackgroundService
{
    public const int MaximumRetainedFiles = 180;
    public static readonly TimeSpan Interval = TimeSpan.FromHours(12);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            LogHeartbeat();
            try
            {
                await Task.Delay(Interval, timeProvider, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    internal void LogHeartbeat() => logger.LogInformation("Scheduled application heartbeat.");
}
