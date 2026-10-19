namespace DotNetLiguriaCore.Tests;

public sealed class FixedAuthorizationClock(DateTimeOffset now) : TimeProvider
{
    private readonly DateTimeOffset _now = now;
    public override DateTimeOffset GetUtcNow() => _now;
}
