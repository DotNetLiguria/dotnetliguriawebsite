using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services;

public sealed class EventbriteIntegrationService(
    EventbriteApiClient apiClient,
    WorkshopService workshopService,
    IOptions<EventbriteOptions> options,
    TimeProvider timeProvider)
{
    private readonly EventbriteOptions _options = options.Value;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task SyncIfReadyAsync(Workshop workshop, CancellationToken cancellationToken = default)
    {
        if (!IsReady(workshop))
        {
            return;
        }
        EnsureConfigured();
        _ = BuildTicketClass(workshop);

        if (string.Equals(workshop.EventbriteSyncStatus, "creating-event", StringComparison.Ordinal) &&
            string.IsNullOrWhiteSpace(workshop.EventbriteEventId))
        {
            throw new InvalidOperationException(
                "Eventbrite event creation has an uncertain result. Reconcile the Eventbrite account before retrying to avoid creating a duplicate.");
        }
        if (string.Equals(workshop.EventbriteSyncStatus, "creating-ticket", StringComparison.Ordinal) &&
            !string.IsNullOrWhiteSpace(workshop.EventbriteEventId) &&
            string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
        {
            throw new InvalidOperationException(
                "Eventbrite ticket creation has an uncertain result. Reconcile the Eventbrite event before retrying to avoid duplicate tickets.");
        }
        if (workshop.EventbriteSyncStatus == "reconciliation-required" &&
            (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) || string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId)))
        {
            throw new InvalidOperationException(
                "An Eventbrite request may have succeeded without its response being saved. Reconcile the Eventbrite account before retrying to avoid duplicates.");
        }

        if (workshop.EventbriteSyncedTicketCapacity > 0 &&
            workshop.EventbriteTicketCapacity < workshop.EventbriteSyncedTicketCapacity)
        {
            throw new InvalidOperationException("Eventbrite ticket capacity can only be increased from the currently synchronized quantity.");
        }

        if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId))
        {
            await CreateEventAsync(workshop, cancellationToken);
            return;
        }

        await UpdateEventAsync(workshop, cancellationToken);
    }

    private async Task CreateEventAsync(Workshop workshop, CancellationToken cancellationToken)
    {
        var timezone = GetConfiguredTimeZone();
        var (startUtc, endUtc) = GetEventTimes(workshop, timezone);
        if (!await workshopService.TryStartEventbriteCreationAsync(workshop.WorkshopId))
        {
            throw new InvalidOperationException("Another Eventbrite create is in progress or requires reconciliation.");
        }
        workshop.EventbriteSyncStatus = "creating-event";
        workshop.EventbriteLastError = null;
        try
        {
            if (string.IsNullOrWhiteSpace(workshop.EventbriteVenueId))
            {
                using var venueResponse = await apiClient.CreateVenueAsync(BuildVenue(workshop), cancellationToken);
                workshop.EventbriteVenueId = GetRequiredString(venueResponse.RootElement, "id");
                await workshopService.UpdateEventbriteAsync(workshop);
            }

            using var eventResponse = await apiClient.CreateEventAsync(
                BuildEvent(workshop, workshop.EventbriteVenueId!, startUtc, endUtc),
                cancellationToken);
            workshop.EventbriteEventId = GetRequiredString(eventResponse.RootElement, "id");
            workshop.EventbriteEventUrl = GetOptionalString(eventResponse.RootElement, "url");
            if (!string.IsNullOrWhiteSpace(workshop.EventbriteEventUrl))
            {
                workshop.ExternalRegistrationLink = workshop.EventbriteEventUrl;
                workshop.ExternalRegistration = true;
            }
            workshop.EventbriteSyncStatus = "event-created";
            await workshopService.UpdateEventbriteAsync(workshop);

            await CreateTicketClassAsync(workshop, cancellationToken);
            await UpdateStructuredContentAsync(workshop, cancellationToken);
            workshop.EventbriteSyncedTicketCapacity = workshop.EventbriteTicketCapacity;
            workshop.EventbriteLastSyncedAt = _timeProvider.GetUtcNow().UtcDateTime;
            workshop.EventbriteSyncStatus = "synced";
            workshop.EventbriteLastError = null;
            await workshopService.UpdateEventbriteAsync(workshop);
        }
        catch (EventbriteApiException exception)
        {
            workshop.EventbriteSyncStatus = exception.StatusCode is null ? "reconciliation-required" : "failed";
            workshop.EventbriteLastError = exception.Message;
            await workshopService.UpdateEventbriteAsync(workshop);
            throw;
        }
    }

    private async Task UpdateEventAsync(Workshop workshop, CancellationToken cancellationToken)
    {
        try
        {
            var timezone = GetConfiguredTimeZone();
            var (startUtc, endUtc) = GetEventTimes(workshop, timezone);

            using var venueResponse = await apiClient.UpdateVenueAsync(workshop.EventbriteVenueId!, BuildVenue(workshop), cancellationToken);
            using var eventResponse = await apiClient.UpdateEventAsync(
                workshop.EventbriteEventId!,
                BuildEvent(workshop, workshop.EventbriteVenueId!, startUtc, endUtc),
                cancellationToken);
            await UpdateStructuredContentAsync(workshop, cancellationToken);

            if (string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
            {
                await CreateTicketClassAsync(workshop, cancellationToken);
                workshop.EventbriteSyncedTicketCapacity = workshop.EventbriteTicketCapacity;
            }
            else
            {
                using var ticketResponse = await apiClient.UpdateTicketClassAsync(
                    workshop.EventbriteEventId!,
                    workshop.EventbriteTicketClassId,
                    BuildTicketClass(workshop),
                    cancellationToken);
                workshop.EventbriteSyncedTicketCapacity = workshop.EventbriteTicketCapacity;
            }

            workshop.EventbriteLastSyncedAt = _timeProvider.GetUtcNow().UtcDateTime;
            workshop.EventbriteSyncStatus = "synced";
            await workshopService.UpdateEventbriteAsync(workshop);
        }
        catch (Exception exception) when (exception is EventbriteApiException or InvalidTimeZoneException or ArgumentException)
        {
            workshop.EventbriteSyncStatus = exception is EventbriteApiException { StatusCode: null }
                ? "reconciliation-required"
                : "failed";
            workshop.EventbriteLastError = exception.Message;
            await workshopService.UpdateEventbriteAsync(workshop);
            throw;
        }
    }

    private async Task UpdateStructuredContentAsync(Workshop workshop, CancellationToken cancellationToken)
    {
        var paragraphs = new List<string>();
        if (!string.IsNullOrWhiteSpace(workshop.Description))
        {
            paragraphs.Add($"<p>{System.Net.WebUtility.HtmlEncode(workshop.Description)}</p>");
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
        var modules = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "text",
                ["data"] = new JsonObject
                {
                    ["body"] = new JsonObject { ["alignment"] = "left", ["text"] = body }
                }
            }
        };
        using var response = await apiClient.UpdateStructuredContentAsync(workshop.EventbriteEventId!, modules, cancellationToken);
    }

    private async Task CreateTicketClassAsync(Workshop workshop, CancellationToken cancellationToken)
    {
        if (!await workshopService.TryStartEventbriteTicketCreationAsync(workshop.WorkshopId))
        {
            throw new InvalidOperationException("Another Eventbrite ticket create is in progress or requires reconciliation.");
        }

        workshop.EventbriteSyncStatus = "creating-ticket";
        using var ticketResponse = await apiClient.CreateTicketClassAsync(
            workshop.EventbriteEventId!,
            BuildTicketClass(workshop),
            cancellationToken);
        workshop.EventbriteTicketClassId = GetRequiredString(ticketResponse.RootElement, "id");
        workshop.EventbriteSyncStatus = "event-created";
        await workshopService.UpdateEventbriteAsync(workshop);
    }

    private JsonObject BuildVenue(Workshop workshop)
    {
        var location = workshop.Location!;
        return new JsonObject
        {
            ["name"] = location.Name,
            ["organizer_id"] = _options.OrganizerId,
            ["address"] = new JsonObject
            {
                ["address_1"] = location.Address,
                ["country"] = _options.CountryCode
            }
        };
    }

    private JsonObject BuildEvent(Workshop workshop, string venueId, DateTimeOffset startUtc, DateTimeOffset endUtc)
    {
        var summary = string.IsNullOrWhiteSpace(workshop.Description)
            ? workshop.Title!
            : workshop.Description.Trim();
        if (summary.Length > 140)
        {
            summary = summary[..137].TrimEnd() + "...";
        }

        return new JsonObject
        {
            ["name"] = new JsonObject { ["html"] = workshop.Title },
            ["summary"] = summary,
            ["start"] = new JsonObject { ["timezone"] = _options.TimeZoneId, ["utc"] = startUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) },
            ["end"] = new JsonObject { ["timezone"] = _options.TimeZoneId, ["utc"] = endUtc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture) },
            ["currency"] = _options.Currency,
            ["organizer_id"] = _options.OrganizerId,
            ["venue_id"] = venueId,
            ["listed"] = true
        };
    }

    private JsonObject BuildTicketClass(Workshop workshop)
    {
        var ticketClass = new JsonObject
        {
            ["name"] = "Free admission",
            ["description"] = "Free admission",
            ["free"] = true,
            ["capacity"] = workshop.EventbriteTicketCapacity
        };
        var timezone = GetConfiguredTimeZone();
        var salesStart = ConvertSalesTime(workshop.EventbriteSalesStart, timezone);
        var salesEnd = ConvertSalesTime(workshop.EventbriteSalesEnd, timezone);
        if (salesStart is not null)
        {
            ticketClass["sales_start"] = salesStart;
        }
        if (salesEnd is not null)
        {
            ticketClass["sales_end"] = salesEnd;
        }
        if (salesStart is not null && salesEnd is not null &&
            StringComparer.Ordinal.Compare(salesStart, salesEnd) >= 0)
        {
            throw new ArgumentException("Eventbrite ticket sales must end after they start.");
        }
        return ticketClass;
    }

    private static string? ConvertSalesTime(string? value, TimeZoneInfo timezone)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        if (!DateTime.TryParseExact(value, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var localTime))
        {
            throw new ArgumentException("Eventbrite ticket sales times must use the local date and time format.");
        }
        if (timezone.IsInvalidTime(localTime) || timezone.IsAmbiguousTime(localTime))
        {
            throw new ArgumentException("The Eventbrite ticket sales time is ambiguous or invalid for the configured timezone.");
        }
        return TimeZoneInfo.ConvertTimeToUtc(localTime, timezone)
            .ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
    }

    private static bool IsReady(Workshop workshop) =>
        !string.IsNullOrWhiteSpace(workshop.Title) &&
        !string.IsNullOrWhiteSpace(workshop.Description) &&
        workshop.EventDate is not null &&
        !string.IsNullOrWhiteSpace(workshop.Location?.Name) &&
        !string.IsNullOrWhiteSpace(workshop.Location?.Address) &&
        workshop.EventbriteTicketCapacity > 0 &&
        workshop.AgendaTracks.Count > 0 &&
        workshop.AgendaItems.Count > 0;

    private static (DateTimeOffset StartUtc, DateTimeOffset EndUtc) GetEventTimes(Workshop workshop, TimeZoneInfo timezone)
    {
        var start = workshop.AgendaItems.Min(item => item.StartTime.TimeOfDay);
        var end = workshop.AgendaItems.Max(item => item.EndTime.TimeOfDay);
        var eventDate = workshop.EventDate!.Value.Date;
        var localStart = DateTime.SpecifyKind(eventDate.Add(start), DateTimeKind.Unspecified);
        var localEnd = DateTime.SpecifyKind(eventDate.Add(end), DateTimeKind.Unspecified);
        if (localEnd <= localStart)
        {
            throw new ArgumentException("The agenda must end after it starts on the workshop event date.");
        }
        if (timezone.IsInvalidTime(localStart) || timezone.IsInvalidTime(localEnd))
        {
            throw new ArgumentException("The agenda time falls in a daylight-saving transition gap for the configured Eventbrite timezone.");
        }
        return (
            new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, timezone), TimeSpan.Zero),
            new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localEnd, timezone), TimeSpan.Zero));
    }

    private TimeZoneInfo GetConfiguredTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(_options.TimeZoneId);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new InvalidOperationException(
                $"Eventbrite:TimeZoneId '{_options.TimeZoneId}' is not a valid timezone on this host.",
                exception);
        }
    }

    private static string GetRequiredString(JsonElement element, string propertyName) =>
        GetOptionalString(element, propertyName) is { Length: > 0 } value
            ? value
            : throw new EventbriteApiException(null, $"Eventbrite response was missing '{propertyName}'.");

    private static string? GetOptionalString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.AccessToken) ||
            string.IsNullOrWhiteSpace(_options.OrganizationId) ||
            string.IsNullOrWhiteSpace(_options.OrganizerId) ||
            string.IsNullOrWhiteSpace(_options.TimeZoneId) ||
            string.IsNullOrWhiteSpace(_options.Currency) ||
            string.IsNullOrWhiteSpace(_options.CountryCode))
        {
            throw new InvalidOperationException(
                "Configure Eventbrite:AccessToken, OrganizationId, OrganizerId, TimeZoneId, Currency, and CountryCode before synchronizing workshops.");
        }
    }
}
