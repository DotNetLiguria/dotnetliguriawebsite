namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterTestTimer : ITimer
{
    private readonly NewsletterTestClock _clock;
    private readonly TimerCallback _callback;
    private readonly object? _state;
    private DateTimeOffset _due;
    private bool _disposed;

    public NewsletterTestTimer(NewsletterTestClock clock, TimerCallback callback, object? state, TimeSpan due)
    {
        _clock = clock;
        _callback = callback;
        _state = state;
        _due = clock.GetUtcNow().Add(due);
    }
    public bool Change(TimeSpan dueTime, TimeSpan period)
    {
        _due = _clock.GetUtcNow().Add(dueTime);
        return !_disposed;
    }
    public void Dispose() => _disposed = true;
    public ValueTask DisposeAsync()
    {
        Dispose();
        return ValueTask.CompletedTask;
    }
    public void FireIfDue()
    {
        if (_disposed || _due > _clock.GetUtcNow()) return;
        _disposed = true;
        _callback(_state);
    }
}
