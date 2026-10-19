using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Authorization;

public static class EventPeriod
{
    public static DateTimeOffset? End(Workshop workshop, TimeZoneInfo zone)
    {
        if (workshop.EventDate is not { } date) return null;
        if (date.Year is < 1900 or > 9998)
            throw new PrivacyBlockedException("event_schedule_invalid", 409);
        var endTimes = workshop.AgendaItems
            .Where(item => item.EndTime != default && item.EndTime.TimeOfDay > item.StartTime.TimeOfDay)
            .Select(item => item.EndTime).ToArray();
        if (endTimes.Length == 0)
            endTimes = (workshop.Tracks ?? [])
                .Where(track => track.EndTime != default && track.EndTime.TimeOfDay > track.StartTime.TimeOfDay)
                .Select(track => track.EndTime).ToArray();
        var local = DateTime.SpecifyKind(endTimes.Length == 0
            ? date.Date.AddDays(1) : date.Date.Add(endTimes.Max(time => time.TimeOfDay)), DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(local))
            throw new PrivacyBlockedException("event_schedule_invalid", 409);
        if (zone.IsAmbiguousTime(local))
            return zone.GetAmbiguousTimeOffsets(local).Select(offset => new DateTimeOffset(local, offset))
                .MaxBy(instant => instant.UtcDateTime);
        return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, zone), TimeSpan.Zero);
    }

    public static bool IsPast(Workshop workshop, TimeProvider clock, TimeZoneInfo zone) =>
        End(workshop, zone) is { } end ? clock.GetUtcNow() >= end
            : workshop.Published == true
                ? throw new PrivacyBlockedException("event_schedule_requires_repair", 409) : false;
}
