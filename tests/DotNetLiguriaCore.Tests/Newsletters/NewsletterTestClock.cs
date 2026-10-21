namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestClock : TimeProvider
{
    private DateTimeOffset _now = new(2026, 10, 21, 10, 0, 0, TimeSpan.Zero);
    private readonly List<NewsletterTestTimer> _timers = [];

    public override DateTimeOffset GetUtcNow() => _now;
    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
    {
        var timer = new NewsletterTestTimer(this, callback, state, dueTime);
        _timers.Add(timer);
        return timer;
    }
    public void Advance(TimeSpan elapsed)
    {
        _now += elapsed;
        foreach (var timer in _timers.ToArray()) timer.FireIfDue();
    }
}
