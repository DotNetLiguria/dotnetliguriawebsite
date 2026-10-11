using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services;

public sealed class EventbriteApiClient(HttpClient httpClient, IOptions<EventbriteOptions> options)
{
    private readonly EventbriteOptions _options = options.Value;
    private string? _waypointToken;

    public async Task<JsonDocument> CreateVenueAsync(JsonObject venue, CancellationToken cancellationToken)
    {
        var response = await SendAsync(
            HttpMethod.Post,
            $"organizations/{Uri.EscapeDataString(Required(_options.OrganizationId, "OrganizationId"))}/venues/",
            new JsonObject { ["venue"] = venue },
            cancellationToken);
        return response;
    }

    public Task<JsonDocument> UpdateVenueAsync(string venueId, JsonObject venue, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, $"venues/{Uri.EscapeDataString(venueId)}/", new JsonObject { ["venue"] = venue }, cancellationToken);

    public Task<JsonDocument> CreateEventAsync(JsonObject eventData, CancellationToken cancellationToken) =>
        SendAsync(
            HttpMethod.Post,
            $"organizations/{Uri.EscapeDataString(Required(_options.OrganizationId, "OrganizationId"))}/events/",
            new JsonObject { ["event"] = eventData },
            cancellationToken);

    public Task<JsonDocument> UpdateEventAsync(string eventId, JsonObject eventData, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, $"events/{Uri.EscapeDataString(eventId)}/", new JsonObject { ["event"] = eventData }, cancellationToken);

    public Task<JsonDocument> CreateTicketClassAsync(string eventId, JsonObject ticketClass, CancellationToken cancellationToken) =>
        SendAsync(
            HttpMethod.Post,
            $"events/{Uri.EscapeDataString(eventId)}/ticket_classes/",
            new JsonObject { ["ticket_class"] = ticketClass },
            cancellationToken);

    public Task<JsonDocument> UpdateTicketClassAsync(string eventId, string ticketClassId, JsonObject ticketClass, CancellationToken cancellationToken) =>
        SendAsync(
            HttpMethod.Post,
            $"events/{Uri.EscapeDataString(eventId)}/ticket_classes/{Uri.EscapeDataString(ticketClassId)}/",
            new JsonObject { ["ticket_class"] = ticketClass },
            cancellationToken);

    public Task<JsonDocument> GetTicketClassAsync(string eventId, string ticketClassId, CancellationToken cancellationToken) =>
        SendAsync(
            HttpMethod.Get,
            $"events/{Uri.EscapeDataString(eventId)}/ticket_classes/{Uri.EscapeDataString(ticketClassId)}/",
            null,
            cancellationToken);

    public Task<JsonDocument> UpdateStructuredContentAsync(string eventId, JsonArray modules, CancellationToken cancellationToken) =>
        SendAsync(
            HttpMethod.Post,
            $"events/{Uri.EscapeDataString(eventId)}/structured_content/2/",
            new JsonObject { ["modules"] = modules, ["publish"] = true },
            cancellationToken);

    public Task<JsonDocument> PublishEventAsync(string eventId, CancellationToken cancellationToken) =>
        SendAsync(HttpMethod.Post, $"events/{Uri.EscapeDataString(eventId)}/publish/", new JsonObject(), cancellationToken);

    private async Task<JsonDocument> SendAsync(HttpMethod method, string path, JsonObject? body, CancellationToken cancellationToken)
    {
        var accessToken = Required(_options.AccessToken, "AccessToken");
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (_waypointToken is not null)
        {
            request.Headers.TryAddWithoutValidation("Eventbrite-API-Waypoint-Token", _waypointToken);
        }
        if (body is not null)
        {
            request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        }

        HttpResponseMessage response;
        try
        {
            response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            throw new EventbriteApiException(null, "Eventbrite could not be reached; the result of the request may be unknown.", exception);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw new EventbriteApiException(null, "The Eventbrite request timed out; the result may be unknown.", exception);
        }

        using (response)
        {
            if (response.Headers.TryGetValues("Eventbrite-API-Waypoint-Token", out var values))
            {
                _waypointToken = values.FirstOrDefault();
            }

            var responseText = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw new EventbriteApiException(response.StatusCode, GetErrorMessage(responseText, response.StatusCode));
            }

            try
            {
                return JsonDocument.Parse(responseText);
            }
            catch (JsonException exception)
            {
                throw new EventbriteApiException(response.StatusCode, "Eventbrite returned an unreadable response.", exception);
            }
        }
    }

    private static string GetErrorMessage(string responseText, HttpStatusCode statusCode)
    {
        try
        {
            using var document = JsonDocument.Parse(responseText);
            if (document.RootElement.TryGetProperty("error_description", out var description) &&
                description.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(description.GetString()))
            {
                return $"Eventbrite rejected the request: {description.GetString()}";
            }

            if (document.RootElement.TryGetProperty("error", out var error) &&
                error.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(error.GetString()))
            {
                return $"Eventbrite rejected the request ({error.GetString()}, HTTP {(int)statusCode}).";
            }
        }
        catch (JsonException)
        {
        }

        return $"Eventbrite rejected the request (HTTP {(int)statusCode}).";
    }

    private static string Required(string? value, string settingName) =>
        !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new InvalidOperationException($"Eventbrite:{settingName} must be configured.");
}
