using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Storage;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services;

public sealed class EventbriteIntegrationService(
    EventbriteApiClient apiClient,
    WorkshopService workshopService,
    WorkshopFileService workshopFileService,
    WorkshopAssetStorage workshopAssetStorage,
    WebsiteStoragePaths storagePaths,
    IOptions<EventbriteOptions> options,
    TimeProvider timeProvider)
{
    private readonly EventbriteOptions _options = options.Value;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly WorkshopFileService _workshopFileService = workshopFileService;
    private readonly WorkshopAssetStorage _workshopAssetStorage = workshopAssetStorage;
    private readonly WebsiteStoragePaths _storagePaths = storagePaths;

    public async Task SyncIfReadyAsync(Workshop workshop, CancellationToken cancellationToken = default)
    {
        if (!IsReady(workshop))
        {
            throw new InvalidOperationException("Complete the workshop title, description, event date, location, free-ticket quantity, agenda track and scheduled agenda before synchronizing Eventbrite.");
        }
        if (!EventbriteEventPayloadBuilder.HasCity(workshop.Location!.Address!))
        {
            throw new InvalidOperationException("Eventbrite requires a city: write the location address as \"street, postal code city\" (for example \"Via Roma 1, 16121 Genova\").");
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

        if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId))
        {
            await CreateEventAsync(workshop, cancellationToken);
            return;
        }

        await UpdateEventAsync(workshop, cancellationToken);
    }

    public async Task<EventbriteTicketSales> GetTicketSalesAsync(Workshop workshop, CancellationToken cancellationToken = default)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) ||
            string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
        {
            throw new InvalidOperationException("Synchronize the Eventbrite event and its free ticket before refreshing ticket sales.");
        }

        using var response = await apiClient.GetTicketClassAsync(
            workshop.EventbriteEventId,
            workshop.EventbriteTicketClassId,
            cancellationToken);
        return EventbriteTicketSales.FromApiResponse(response.RootElement, _timeProvider.GetUtcNow());
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
        var eventCreateRequested = false;
        try
        {
            await UploadWorkshopImageIfChangedAsync(workshop, cancellationToken);
            if (string.IsNullOrWhiteSpace(workshop.EventbriteVenueId))
            {
                using var venueResponse = await apiClient.CreateVenueAsync(
                    EventbriteEventPayloadBuilder.BuildVenue(workshop, _options), cancellationToken);
                workshop.EventbriteVenueId = GetRequiredString(venueResponse.RootElement, "id");
                await workshopService.UpdateEventbriteAsync(workshop);
            }

            eventCreateRequested = true;
            using var eventResponse = await apiClient.CreateEventAsync(
                EventbriteEventPayloadBuilder.BuildEvent(
                    workshop, workshop.EventbriteVenueId!, startUtc, endUtc, _options),
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
        catch (Exception exception) when (
            exception is EventbriteApiException or InvalidOperationException or IOException or ArgumentException)
        {
            // Image and venue creates cannot duplicate the event, so an unknown outcome before the
            // event create request is retryable.
            workshop.EventbriteSyncStatus = eventCreateRequested && exception is EventbriteApiException { StatusCode: null }
                ? "reconciliation-required"
                : "failed";
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

            if (!string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId) &&
                workshop.EventbriteTicketCapacity < workshop.EventbriteSyncedTicketCapacity)
            {
                var sales = await GetTicketSalesAsync(workshop, cancellationToken);
                var minimumCapacity = sales.Sold + sales.Pending;
                if (workshop.EventbriteTicketCapacity < minimumCapacity)
                {
                    throw new InvalidOperationException(
                        $"Ticket capacity must be at least {minimumCapacity} (sold: {sales.Sold}, pending: {sales.Pending}).");
                }
            }

            await UploadWorkshopImageIfChangedAsync(workshop, cancellationToken);
            using var venueResponse = await apiClient.UpdateVenueAsync(
                workshop.EventbriteVenueId!,
                EventbriteEventPayloadBuilder.BuildVenue(workshop, _options),
                cancellationToken);
            using var eventResponse = await apiClient.UpdateEventAsync(
                workshop.EventbriteEventId!,
                EventbriteEventPayloadBuilder.BuildEvent(
                    workshop, workshop.EventbriteVenueId!, startUtc, endUtc, _options),
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
            workshop.EventbriteLastError = null;
            await workshopService.UpdateEventbriteAsync(workshop);
        }
        catch (Exception exception) when (
            exception is EventbriteApiException or InvalidOperationException or IOException or InvalidTimeZoneException or ArgumentException)
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
        using var response = await apiClient.UpdateStructuredContentAsync(
            workshop.EventbriteEventId!,
            EventbriteEventPayloadBuilder.BuildStructuredContent(workshop),
            cancellationToken);
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

    private async Task UploadWorkshopImageIfChangedAsync(Workshop workshop, CancellationToken cancellationToken)
    {
        var image = await ReadWorkshopImageAsync(workshop, cancellationToken);
        if (image is null)
        {
            return;
        }

        var hash = Convert.ToHexString(SHA256.HashData(image.Value.Bytes));
        if (string.Equals(workshop.EventbriteImageSha256, hash, StringComparison.Ordinal) &&
            !string.IsNullOrWhiteSpace(workshop.EventbriteLogoId))
        {
            return;
        }

        using var response = await apiClient.UploadMediaAsync(
            image.Value.Bytes, image.Value.FileName, image.Value.ContentType, cancellationToken);
        workshop.EventbriteLogoId = GetRequiredString(response.RootElement, "id");
        workshop.EventbriteImageSha256 = hash;
        await workshopService.UpdateEventbriteAsync(workshop);
    }

    private async Task<(byte[] Bytes, string FileName, string ContentType)?> ReadWorkshopImageAsync(
        Workshop workshop,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(workshop.Image))
        {
            return null;
        }

        const string privateImagePrefix = "/api/WorkshopFile/Download/";
        string? path;
        if (workshop.Image.StartsWith(privateImagePrefix, StringComparison.Ordinal))
        {
            var fileIdText = workshop.Image[privateImagePrefix.Length..];
            if (!Guid.TryParseExact(fileIdText, "D", out var fileId))
            {
                throw new InvalidOperationException("The workshop image path is not a valid uploaded image.");
            }

            var file = await _workshopFileService.GetFileAsync(fileId);
            if (file is null || file.WorkshopId != workshop.WorkshopId || file.FileType != WorkshopFileTypeEnum.Image)
            {
                throw new InvalidOperationException("The workshop image file is missing or does not belong to this workshop.");
            }

            path = _workshopAssetStorage.PathFor(file);
        }
        else
        {
            if (!workshop.Image.StartsWith("/workshops/", StringComparison.Ordinal) &&
                !workshop.Image.StartsWith("workshops/", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("Only a locally stored workshop image can be synchronized to Eventbrite.");
            }

            var relativePath = workshop.Image.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var contentRoot = Path.GetFullPath(_storagePaths.ContentsRoot);
            var contentRootPrefix = contentRoot.EndsWith(Path.DirectorySeparatorChar)
                ? contentRoot
                : contentRoot + Path.DirectorySeparatorChar;
            path = Path.GetFullPath(Path.Combine(contentRoot, relativePath));
            if (!path.StartsWith(contentRootPrefix, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("The workshop image path is outside the contents directory.");
            }

            if (!File.Exists(path))
            {
                return null;
            }
        }

        var extension = Path.GetExtension(path).ToLowerInvariant();
        var contentType = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => throw new InvalidOperationException("The workshop image has an unsupported file type.")
        };
        var fileInfo = new FileInfo(path);
        if (fileInfo.Length is <= 0 or > WorkshopAssetStorage.MaximumBytes)
        {
            throw new InvalidOperationException("The workshop image exceeds the permitted upload size.");
        }

        return (await File.ReadAllBytesAsync(path, cancellationToken), Path.GetFileName(path), contentType);
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
        var (salesStart, salesEnd) = EventbriteSalesTimes.ToUtc(
            workshop.EventbriteSalesStart, workshop.EventbriteSalesEnd, timezone);
        if (salesStart is not null)
        {
            ticketClass["sales_start"] = salesStart;
        }
        if (salesEnd is not null)
        {
            ticketClass["sales_end"] = salesEnd;
        }
        return ticketClass;
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
        if (string.IsNullOrWhiteSpace(
                string.IsNullOrWhiteSpace(_options.PrivateToken) ? _options.AccessToken : _options.PrivateToken) ||
            string.IsNullOrWhiteSpace(_options.OrganizationId) ||
            string.IsNullOrWhiteSpace(_options.OrganizerId) ||
            string.IsNullOrWhiteSpace(_options.TimeZoneId) ||
            string.IsNullOrWhiteSpace(_options.Currency) ||
            string.IsNullOrWhiteSpace(_options.CountryCode))
        {
            throw new InvalidOperationException(
                "Configure Eventbrite:PrivateToken, OrganizationId, OrganizerId, TimeZoneId, Currency, and CountryCode before synchronizing workshops.");
        }
    }
}
