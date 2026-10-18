namespace DotNetLiguriaCore.Tests.Privacy;

internal sealed class PrivacyTestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 10, 18, 12, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
