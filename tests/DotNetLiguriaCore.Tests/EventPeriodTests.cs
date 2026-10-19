using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class EventPeriodTests
{
    [Fact]
    public void ScheduledEndUsesRomeNotHostTimeAndIncludesTheBoundary()
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome");
        var workshop = new Workshop
        {
            EventDate = new DateTime(2026, 10, 19),
            AgendaItems = [new WorkshopAgendaItem { EndTime = new DateTime(2026, 10, 19, 18, 0, 0) }],
        };
        Assert.Equal(new DateTimeOffset(2026, 10, 19, 16, 0, 0, TimeSpan.Zero), EventPeriod.End(workshop, zone));
        Assert.False(EventPeriod.IsPast(workshop, new FixedAuthorizationClock(new DateTimeOffset(2026, 10, 19, 15, 59, 59, TimeSpan.Zero)), zone));
        Assert.True(EventPeriod.IsPast(workshop, new FixedAuthorizationClock(new DateTimeOffset(2026, 10, 19, 16, 0, 0, TimeSpan.Zero)), zone));
    }

    [Fact]
    public void DateOnlyFallbackUsesNextLocalMidnightAcrossDst()
    {
        var end = EventPeriod.End(new Workshop { EventDate = new DateTime(2026, 3, 29) },
            TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome"));
        Assert.Equal(new DateTimeOffset(2026, 3, 29, 22, 0, 0, TimeSpan.Zero), end);
    }

    [Fact]
    public void AmbiguousLegacyEndUsesTheLaterInstant()
    {
        var workshop = new Workshop
        {
            EventDate = new DateTime(2026, 10, 25),
            Tracks = [new WorkshopTrack { EndTime = new DateTime(2026, 10, 25, 2, 30, 0) }],
        };
        Assert.Equal(new DateTimeOffset(2026, 10, 25, 1, 30, 0, TimeSpan.Zero),
            EventPeriod.End(workshop, TimeZoneInfo.FindSystemTimeZoneById("Europe/Rome")));
    }

    [Fact]
    public void UnscheduledDraftIsEditableButUndatedPublishedDataNeedsRepair()
    {
        var zone = TimeZoneInfo.Utc;
        var clock = new FixedAuthorizationClock(DateTimeOffset.UnixEpoch);
        Assert.False(EventPeriod.IsPast(new Workshop(), clock, zone));
        Assert.Throws<PrivacyBlockedException>(() => EventPeriod.IsPast(new Workshop { Published = true }, clock, zone));
    }

    [Fact]
    public void InvalidScheduleFallsBackToNextDayInsteadOfBecomingPastPrematurely()
    {
        var workshop = new Workshop
        {
            EventDate = new DateTime(2026, 10, 19),
            AgendaItems = [new WorkshopAgendaItem
            {
                StartTime = new DateTime(2026, 10, 19, 18, 0, 0),
                EndTime = new DateTime(2026, 10, 19, 12, 0, 0),
            }],
        };
        Assert.Equal(new DateTimeOffset(2026, 10, 20, 0, 0, 0, TimeSpan.Zero),
            EventPeriod.End(workshop, TimeZoneInfo.Utc));
    }
}
