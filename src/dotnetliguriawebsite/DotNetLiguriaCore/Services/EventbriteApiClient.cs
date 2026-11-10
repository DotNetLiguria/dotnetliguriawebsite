using System.Globalization;
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

    public async Task<JsonDocument> UploadMediaAsync(
        byte[] image,
        string fileName,
        string contentType,
        CancellationToken cancellationToken)
    {
        // Eventbrite upload flow: get signed instructions, post the file to the upload URL, then notify with the token.
        string uploadToken;
        string uploadUrl;
        string fileParameterName;
        var uploadFields = new List<KeyValuePair<string, string>>();
        using (var instructions = await SendAsync(HttpMethod.Get, "media/upload/?type=image-event-logo", null, cancellationToken))
        {
            var root = instructions.RootElement;
            uploadToken = RequiredProperty(root, "upload_token");
            uploadUrl = RequiredProperty(root, "upload_url");
            fileParameterName = root.TryGetProperty("file_parameter_name", out var parameter) &&
                parameter.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(parameter.GetString())
                    ? parameter.GetString()!
                    : "file";
            if (root.TryGetProperty("upload_data", out var data) && data.ValueKind == JsonValueKind.Object)
            {
                foreach (var field in data.EnumerateObject())
                {
                    uploadFields.Add(new(field.Name, field.Value.ValueKind == JsonValueKind.String ? field.Value.GetString()! : field.Value.GetRawText()));
                }
            }
        }

        if (!Uri.TryCreate(uploadUrl, UriKind.Absolute, out var uploadUri) || uploadUri.Scheme != Uri.UriSchemeHttps)
        {
            throw new EventbriteApiException(HttpStatusCode.OK, "Eventbrite returned an invalid upload URL.");
        }

        using (var content = new MultipartFormDataContent())
        {
            foreach (var field in uploadFields)
            {
                content.Add(new StringContent(field.Value), field.Key);
            }
            var fileContent = new ByteArrayContent(image);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Add(fileContent, fileParameterName, fileName);

            // The signed upload URL must not receive the Eventbrite bearer token.
            using var request = new HttpRequestMessage(HttpMethod.Post, uploadUri) { Content = content };
            HttpResponseMessage response;
            try
            {
                response = await httpClient.SendAsync(request, cancellationToken);
            }
            catch (HttpRequestException exception)
            {
                throw new EventbriteApiException(null, "The Eventbrite image upload could not be completed.", exception);
            }
            catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
            {
                throw new EventbriteApiException(null, "The Eventbrite image upload timed out.", exception);
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    throw new EventbriteApiException(response.StatusCode, $"Eventbrite rejected the image upload (HTTP {(int)response.StatusCode}).");
                }
            }
        }

        return await SendAsync(HttpMethod.Post, "media/upload/", new JsonObject { ["upload_token"] = uploadToken }, cancellationToken);
    }

    private static string RequiredProperty(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.String &&
        !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()!
            : throw new EventbriteApiException(HttpStatusCode.OK, $"Eventbrite returned upload instructions without {name}.");

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

    public async Task<JsonDocument> UpdateStructuredContentAsync(string eventId, JsonArray modules, CancellationToken cancellationToken)
    {
        // Each write must target the version after the latest working (published or draft) version.
        int currentVersion;
        try
        {
            using var current = await SendAsync(
                HttpMethod.Get,
                $"events/{Uri.EscapeDataString(eventId)}/structured_content/edit/?purpose=listing",
                null,
                cancellationToken);
            currentVersion = ReadPageVersion(current.RootElement);
        }
        catch (EventbriteApiException exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            currentVersion = 0;
        }

        return await SendAsync(
            HttpMethod.Post,
            $"events/{Uri.EscapeDataString(eventId)}/structured_content/{(currentVersion + 1).ToString(CultureInfo.InvariantCulture)}/",
            new JsonObject { ["modules"] = modules, ["publish"] = true, ["purpose"] = "listing" },
            cancellationToken);
    }

    public async Task PublishEventAsync(string eventId, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(
            HttpMethod.Post, $"events/{Uri.EscapeDataString(eventId)}/publish/", new JsonObject(), cancellationToken);
        if (response.RootElement.ValueKind == JsonValueKind.Object &&
            response.RootElement.TryGetProperty("published", out var published) &&
            published.ValueKind == JsonValueKind.False)
        {
            throw new EventbriteApiException(HttpStatusCode.OK, "Eventbrite did not publish the event.");
        }
    }

    private static int ReadPageVersion(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty("page_version_number", out var version))
        {
            return 0;
        }

        if (version.ValueKind == JsonValueKind.Number && version.TryGetInt32(out var number) && number >= 0)
        {
            return number;
        }
        if (version.ValueKind == JsonValueKind.String &&
            int.TryParse(version.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out number) &&
            number >= 0)
        {
            return number;
        }
        if (version.ValueKind is JsonValueKind.Null ||
            version.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(version.GetString()))
        {
            return 0;
        }

        throw new EventbriteApiException(HttpStatusCode.OK, "Eventbrite returned an invalid structured content version.");
    }

    private Task<JsonDocument> SendAsync(HttpMethod method, string path, JsonObject? body, CancellationToken cancellationToken) =>
        SendContentAsync(
            method,
            path,
            body is null ? null : new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
            cancellationToken);

    private async Task<JsonDocument> SendContentAsync(HttpMethod method, string path, HttpContent? content, CancellationToken cancellationToken)
    {
        var accessToken = Required(
            string.IsNullOrWhiteSpace(_options.PrivateToken) ? _options.AccessToken : _options.PrivateToken,
            "PrivateToken");
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (_waypointToken is not null)
        {
            request.Headers.TryAddWithoutValidation("Eventbrite-API-Waypoint-Token", _waypointToken);
        }
        request.Content = content;

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
