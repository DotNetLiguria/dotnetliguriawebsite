using BlazorQuestionarioServer.Service;
using Microsoft.Extensions.Time.Testing;
using Xunit;

namespace ServerQuestionnaire.Tests;

public class CircuitCounterTests
{
    [Fact]
    public void ReportsEveryThirtySecondsAndCountsEachCircuitOnce()
    {
        var time = new FakeTimeProvider(new DateTimeOffset(2024, 1, 1, 0, 0, 0, TimeSpan.Zero));
        var metrics = new List<(string Name, int Count)>();
        using var handler = new CountCircuitHandler(time, (name, count) => metrics.Add((name, count)));
        handler.OpenCircuit("first");
        handler.OpenCircuit("first");
        handler.OpenCircuit("second");
        time.Advance(TimeSpan.FromSeconds(29));
        Assert.Empty(metrics);
        time.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(("NumCircuitiAperti", 2), Assert.Single(metrics));
        handler.CloseCircuit("first");
        handler.CloseCircuit("missing");
        time.Advance(TimeSpan.FromSeconds(30));
        Assert.Equal(("NumCircuitiAperti", 1), metrics[1]);
        Assert.Equal(["second"], handler.listacircuitiaperti);
    }

    [Fact]
    public void DisposalStopsTheTimerAndIsIdempotent()
    {
        var time = new FakeTimeProvider();
        var count = 0;
        var handler = new CountCircuitHandler(time, (_, _) => count++);
        time.Advance(TimeSpan.FromSeconds(30));
        Assert.Equal(1, count);
        handler.Dispose();
        handler.Dispose();
        time.Advance(TimeSpan.FromHours(1));
        Assert.Equal(1, count);
    }
}