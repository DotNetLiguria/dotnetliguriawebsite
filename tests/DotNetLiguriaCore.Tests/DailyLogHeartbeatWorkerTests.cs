using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class DailyLogHeartbeatWorkerTests
{
    [Fact]
    public async Task WritesHeartbeatOnStartupAndUsesTwelveHourInterval()
    {
        var logger = new CapturingLogger<DailyLogHeartbeatWorker>();
        var worker = new DailyLogHeartbeatWorker(logger, new FixedAuthorizationClock(DateTimeOffset.UnixEpoch));

        worker.LogHeartbeat();

        Assert.Equal(TimeSpan.FromHours(12), DailyLogHeartbeatWorker.Interval);
        Assert.Equal(new[] { "Scheduled application heartbeat." }, logger.Messages);
    }

    [Fact]
    public void RetentionLimitIsSixMonthsOfDailyFiles()
    {
        Assert.Equal(180, DailyLogHeartbeatWorker.MaximumRetainedFiles);
    }
}
