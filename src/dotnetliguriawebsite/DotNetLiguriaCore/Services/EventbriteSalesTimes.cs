using System.Globalization;

namespace DotNetLiguriaCore.Services;

public static class EventbriteSalesTimes
{
    public static (string? Start, string? End) ToUtc(string? start, string? end, TimeZoneInfo timezone)
    {
        var startUtc = Convert(start, timezone);
        var endUtc = Convert(end, timezone);
        if (startUtc is not null && endUtc is not null &&
            StringComparer.Ordinal.Compare(startUtc, endUtc) >= 0)
            throw new ArgumentException("Eventbrite ticket sales must end after they start.");
        return (startUtc, endUtc);
    }

    private static string? Convert(string? value, TimeZoneInfo timezone)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var localTime))
            throw new ArgumentException("Eventbrite ticket sales times must use the local date and time format.");
        if (timezone.IsInvalidTime(localTime) || timezone.IsAmbiguousTime(localTime))
            throw new ArgumentException("The Eventbrite ticket sales time is ambiguous or invalid for the configured timezone.");
        return TimeZoneInfo.ConvertTimeToUtc(localTime, timezone)
            .ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
    }
}
