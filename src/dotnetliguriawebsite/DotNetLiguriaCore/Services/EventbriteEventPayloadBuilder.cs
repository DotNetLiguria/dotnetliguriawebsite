using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

internal static class EventbriteEventPayloadBuilder
{
    public static JsonObject BuildVenue(Workshop workshop, EventbriteOptions options)
    {
        var location = workshop.Location!;
        var parts = SplitAddress(location.Address!);
        var address = new JsonObject
        {
            ["address_1"] = parts.Street,
            ["city"] = parts.City,
            ["country"] = options.CountryCode
        };
        if (parts.PostalCode is not null)
        {
            address["postal_code"] = parts.PostalCode;
        }
        var venue = new JsonObject
        {
            ["name"] = location.Name,
            ["organizer_id"] = options.OrganizerId,
            ["address"] = address
        };

        // Eventbrite accepts coordinates only inside the address object, as strings.
        if (TryParseCoordinates(location.Coordinates, out var latitude, out var longitude))
        {
            address["latitude"] = latitude.ToString(CultureInfo.InvariantCulture);
            address["longitude"] = longitude.ToString(CultureInfo.InvariantCulture);
        }

        return venue;
    }

    public static JsonObject BuildEvent(
        Workshop workshop,
        string venueId,
        DateTimeOffset startUtc,
        DateTimeOffset endUtc,
        EventbriteOptions options)
    {
        var summary = string.IsNullOrWhiteSpace(workshop.Description)
            ? workshop.Title!
            : workshop.Description.Trim();
        if (summary.Length > 140)
        {
            summary = summary[..137].TrimEnd() + "...";
        }

        var eventData = new JsonObject
        {
            ["name"] = new JsonObject { ["html"] = workshop.Title },
            ["summary"] = summary,
            ["start"] = new JsonObject { ["timezone"] = options.TimeZoneId, ["utc"] = startUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) },
            ["end"] = new JsonObject { ["timezone"] = options.TimeZoneId, ["utc"] = endUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) },
            ["currency"] = options.Currency,
            ["organizer_id"] = options.OrganizerId,
            ["venue_id"] = venueId,
            ["listed"] = true
        };
        if (!string.IsNullOrWhiteSpace(workshop.EventbriteLogoId))
        {
            eventData["logo_id"] = workshop.EventbriteLogoId;
        }

        return eventData;
    }

    public static JsonArray BuildStructuredContent(Workshop workshop)
    {
        var paragraphs = new List<string>();
        if (!string.IsNullOrWhiteSpace(workshop.Description))
        {
            paragraphs.Add($"<p>{System.Net.WebUtility.HtmlEncode(workshop.Description)}</p>");
        }

        if (!string.IsNullOrWhiteSpace(workshop.AttendeeNotes))
        {
            paragraphs.Add($"<p><strong>Notes for participants</strong><br>{System.Net.WebUtility.HtmlEncode(workshop.AttendeeNotes)}</p>");
        }

        if (!string.IsNullOrWhiteSpace(workshop.BookingServiceUrl))
        {
            paragraphs.Add($"<p><strong>Booking and cancellation</strong><br>{System.Net.WebUtility.HtmlEncode(workshop.BookingServiceUrl)}</p>");
        }

        var talks = workshop.Talks.ToDictionary(talk => talk.WorkshopTalkId);
        var tracks = workshop.AgendaTracks.ToDictionary(track => track.WorkshopAgendaTrackId);
        var items = workshop.AgendaItems.OrderBy(item => item.StartTime).ToList();
        if (items.Count > 0)
        {
            paragraphs.Add("<p><strong>Agenda</strong></p><ul>");
            foreach (var item in items)
            {
                var title = item.Title;
                if (string.IsNullOrWhiteSpace(title) && item.TalkId is Guid talkId && talks.TryGetValue(talkId, out var talk))
                {
                    title = talk.Title;
                }

                var start = item.StartTime.ToString("HH:mm", CultureInfo.InvariantCulture);
                var end = item.EndTime.ToString("HH:mm", CultureInfo.InvariantCulture);
                var room = string.IsNullOrWhiteSpace(item.RoomName) ? string.Empty : $" — {System.Net.WebUtility.HtmlEncode(item.RoomName)}";
                var track = item.TrackId is Guid trackId && tracks.TryGetValue(trackId, out var agendaTrack)
                    ? $" — {System.Net.WebUtility.HtmlEncode(agendaTrack.Name)}"
                    : string.Empty;
                var talkDetails = item.TalkId is Guid scheduledTalkId && talks.TryGetValue(scheduledTalkId, out var scheduledTalk)
                    ? string.Join(" ", new[]
                    {
                        scheduledTalk.Abstract,
                        string.Join(", ", scheduledTalk.Speakers.Select(speaker => speaker.Name).Where(name => !string.IsNullOrWhiteSpace(name)))
                    }.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => System.Net.WebUtility.HtmlEncode(value)))
                    : string.Empty;
                var details = string.IsNullOrWhiteSpace(talkDetails) ? string.Empty : $" — {talkDetails}";
                paragraphs.Add($"<li><strong>{start}–{end}</strong> {System.Net.WebUtility.HtmlEncode(title ?? item.ItemType ?? "Session")}{track}{room}{details}</li>");
            }
            paragraphs.Add("</ul>");
        }

        var body = string.Join(Environment.NewLine, paragraphs);
        return
        [
            new JsonObject
            {
                ["type"] = "text",
                ["data"] = new JsonObject
                {
                    ["body"] = new JsonObject { ["alignment"] = "left", ["text"] = body }
                }
            }
        ];
    }

    public static bool HasCity(string address) => SplitAddress(address).City is not null;

    private static (string Street, string? City, string? PostalCode) SplitAddress(string address)
    {
        var segments = address
            .Split([",", " - "], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
        if (segments.Count > 2 && segments[^1].ToUpperInvariant() is "ITALIA" or "ITALY" or "IT")
        {
            segments.RemoveAt(segments.Count - 1);
        }
        if (segments.Count < 2)
        {
            return (address.Trim(), null, null);
        }

        var match = Regex.Match(segments[^1], @"^(?:(?<postal>\d{5})\s+)?(?<city>.*?)\s*(?:\([A-Za-z]{2}\))?$");
        var city = match.Groups["city"].Value;
        if (city.Length == 0 || city.Any(char.IsDigit))
        {
            return (address.Trim(), null, null);
        }

        var postalCode = match.Groups["postal"].Success ? match.Groups["postal"].Value : null;
        return (string.Join(", ", segments.Take(segments.Count - 1)), city, postalCode);
    }

    private static bool TryParseCoordinates(string? coordinates, out double latitude, out double longitude)
    {
        latitude = 0;
        longitude = 0;
        var parts = coordinates?.Split(',', StringSplitOptions.TrimEntries);
        return parts is { Length: 2 } &&
            double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out latitude) &&
            double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out longitude) &&
            latitude is >= -90 and <= 90 &&
            longitude is >= -180 and <= 180;
    }
}
