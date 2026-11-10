using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using DotNetLiguriaCore.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class EventbriteApiClientTests
{
    [Fact]
    public async Task CreateEventAsync_sends_bearer_token_and_organization_event_payload()
    {
        HttpRequestMessage? capturedRequest = null;
        string? capturedBody = null;
        var handler = new EventbriteHttpMessageHandler(async (request, cancellationToken) =>
        {
            capturedRequest = request;
            capturedBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"id":"event-1"}""", Encoding.UTF8, "application/json")
            };
        });
        var client = CreateClient(handler, new EventbriteOptions
        {
            AccessToken = "fake-token",
            OrganizationId = "org-7"
        });

        using var response = await client.CreateEventAsync(
            new JsonObject { ["name"] = new JsonObject { ["html"] = "Test event" } },
            CancellationToken.None);

        Assert.Equal("event-1", response.RootElement.GetProperty("id").GetString());
        Assert.Equal(HttpMethod.Post, capturedRequest?.Method);
        Assert.Equal("/v3/organizations/org-7/events/", capturedRequest?.RequestUri?.AbsolutePath);
        Assert.Equal("Bearer", capturedRequest?.Headers.Authorization?.Scheme);
        Assert.Equal("fake-token", capturedRequest?.Headers.Authorization?.Parameter);
        var body = JsonNode.Parse(capturedBody!);
        Assert.Equal("Test event", body?["event"]?["name"]?["html"]?.GetValue<string>());
    }

    [Fact]
    public async Task UploadMediaAsync_uses_signed_upload_then_notifies_with_token()
    {
        var requests = new List<(HttpMethod Method, Uri Uri, string? Token, string? Body)>();
        var partNames = new List<string?>();
        string? fileName = null;
        byte[]? sentBytes = null;
        var handler = new EventbriteHttpMessageHandler(async (request, cancellationToken) =>
        {
            string? body = null;
            if (request.Content is MultipartFormDataContent multipart)
            {
                foreach (var part in multipart)
                {
                    partNames.Add(part.Headers.ContentDisposition?.Name?.Trim('"'));
                }
                var file = multipart.Last();
                fileName = file.Headers.ContentDisposition?.FileName?.Trim('"');
                sentBytes = await file.ReadAsByteArrayAsync(cancellationToken);
            }
            else if (request.Content is not null)
            {
                body = await request.Content.ReadAsStringAsync(cancellationToken);
            }
            requests.Add((request.Method, request.RequestUri!, request.Headers.Authorization?.Parameter, body));
            var json = requests.Count switch
            {
                1 => """{"upload_url":"https://upload.example.test/put","upload_token":"tok-9","file_parameter_name":"file","upload_data":{"key":"k1","policy":"p1"}}""",
                2 => "",
                _ => """{"id":"logo-1"}""",
            };
            return new HttpResponseMessage(requests.Count == 2 ? HttpStatusCode.NoContent : HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });
        var client = CreateClient(handler, new EventbriteOptions { PrivateToken = "private-token" });
        var expectedBytes = new byte[] { 137, 80, 78, 71 };

        using var response = await client.UploadMediaAsync(
            expectedBytes, "workshop.png", "image/png", CancellationToken.None);

        Assert.Equal("logo-1", response.RootElement.GetProperty("id").GetString());
        Assert.Equal(3, requests.Count);
        Assert.Equal(HttpMethod.Get, requests[0].Method);
        Assert.Equal("/v3/media/upload/?type=image-event-logo", requests[0].Uri.PathAndQuery);
        Assert.Equal("private-token", requests[0].Token);

        Assert.Equal("https://upload.example.test/put", requests[1].Uri.ToString());
        Assert.Null(requests[1].Token);
        Assert.Equal(["key", "policy", "file"], partNames);
        Assert.Equal("workshop.png", fileName);
        Assert.Equal(expectedBytes, sentBytes);

        Assert.Equal(HttpMethod.Post, requests[2].Method);
        Assert.Equal("/v3/media/upload/", requests[2].Uri.AbsolutePath);
        Assert.Equal("tok-9", JsonNode.Parse(requests[2].Body!)?["upload_token"]?.GetValue<string>());
    }

    [Fact]
    public async Task UploadMediaAsync_fails_when_signed_upload_is_rejected()
    {
        var calls = 0;
        var handler = new EventbriteHttpMessageHandler((_, _) =>
        {
            calls++;
            return Task.FromResult(calls == 1
                ? new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("""{"upload_url":"https://upload.example.test/put","upload_token":"tok"}""", Encoding.UTF8, "application/json")
                }
                : new HttpResponseMessage(HttpStatusCode.Forbidden));
        });
        var client = CreateClient(handler, new EventbriteOptions { PrivateToken = "private-token" });

        var exception = await Assert.ThrowsAsync<EventbriteApiException>(() =>
            client.UploadMediaAsync([1], "a.png", "image/png", CancellationToken.None));

        Assert.Equal(HttpStatusCode.Forbidden, exception.StatusCode);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task Sequential_requests_forward_latest_waypoint_token()
    {
        var calls = 0;
        string? secondWaypoint = null;
        var handler = new EventbriteHttpMessageHandler((request, _) =>
        {
            calls++;
            if (calls == 2)
            {
                secondWaypoint = request.Headers.GetValues("Eventbrite-API-Waypoint-Token").Single();
            }

            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            };
            if (calls == 1)
            {
                response.Headers.Add("Eventbrite-API-Waypoint-Token", "waypoint-1");
            }
            return Task.FromResult(response);
        });
        var client = CreateClient(handler, new EventbriteOptions
        {
            AccessToken = "fake-token",
            OrganizationId = "org-7"
        });

        using var first = await client.CreateEventAsync(new JsonObject(), CancellationToken.None);
        using var second = await client.UpdateEventAsync("event-2", new JsonObject(), CancellationToken.None);

        Assert.Equal("waypoint-1", secondWaypoint);
    }

    [Fact]
    public async Task UpdateTicketClassAsync_uses_eventbrite_capacity_endpoint_and_payload()
    {
        string? requestPath = null;
        string? requestBody = null;
        var handler = new EventbriteHttpMessageHandler(async (request, cancellationToken) =>
        {
            requestPath = request.RequestUri?.AbsolutePath;
            requestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"id":"ticket-3","capacity":45}""", Encoding.UTF8, "application/json")
            };
        });
        var client = CreateClient(handler, new EventbriteOptions { AccessToken = "fake-token" });

        using var response = await client.UpdateTicketClassAsync(
            "event-2",
            "ticket-3",
            new JsonObject { ["capacity"] = 45, ["free"] = true },
            CancellationToken.None);

        Assert.Equal("/v3/events/event-2/ticket_classes/ticket-3/", requestPath);
        var body = JsonNode.Parse(requestBody!);
        Assert.Equal(45, body?["ticket_class"]?["capacity"]?.GetValue<int>());
        Assert.Equal(true, body?["ticket_class"]?["free"]?.GetValue<bool>());
    }

    [Fact]
    public async Task GetTicketClassAsync_uses_eventbrite_ticket_read_endpoint()
    {
        string? requestPath = null;
        var handler = new EventbriteHttpMessageHandler((request, _) =>
        {
            requestPath = request.RequestUri?.AbsolutePath;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"capacity":50,"quantity_sold":12,"quantity_pending":3,"quantity_available":35}""", Encoding.UTF8, "application/json")
            });
        });
        var client = CreateClient(handler, new EventbriteOptions { AccessToken = "fake-token" });

        using var response = await client.GetTicketClassAsync("event-2", "ticket-3", CancellationToken.None);
        var sales = EventbriteTicketSales.FromApiResponse(response.RootElement, DateTimeOffset.Parse("2026-10-11T10:00:00Z"));

        Assert.Equal("/v3/events/event-2/ticket_classes/ticket-3/", requestPath);
        Assert.Equal(new EventbriteTicketSales(50, 12, 3, 35, DateTimeOffset.Parse("2026-10-11T10:00:00Z")), sales);
    }

    [Fact]
    public void Ticket_sales_summary_defaults_pending_to_zero_and_derives_remaining()
    {
        using var document = System.Text.Json.JsonDocument.Parse("""{"capacity":"20","quantity_sold":7}""");
        var refreshedAt = DateTimeOffset.Parse("2026-10-11T10:00:00Z");

        var sales = EventbriteTicketSales.FromApiResponse(document.RootElement, refreshedAt);

        Assert.Equal(new EventbriteTicketSales(20, 7, 0, 13, refreshedAt), sales);
    }

    [Fact]
    public void Ticket_sales_summary_rejects_missing_sold_count()
    {
        using var document = System.Text.Json.JsonDocument.Parse("""{"capacity":20}""");

        var exception = Assert.Throws<EventbriteApiException>(() =>
            EventbriteTicketSales.FromApiResponse(document.RootElement, DateTimeOffset.Parse("2026-10-11T10:00:00Z")));

        Assert.Contains("sold quantity", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Non_success_response_surfaces_status_without_returning_success_shaped_data()
    {
        var handler = new EventbriteHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)
        {
            Content = new StringContent("""{"error":"NOT_AUTHORIZED","error_description":"Access denied"}""", Encoding.UTF8, "application/json")
        }));
        var client = CreateClient(handler, new EventbriteOptions
        {
            AccessToken = "fake-token",
            OrganizationId = "org-7"
        });

        var exception = await Assert.ThrowsAsync<EventbriteApiException>(() =>
            client.CreateEventAsync(new JsonObject(), CancellationToken.None));

        Assert.Equal(HttpStatusCode.Forbidden, exception.StatusCode);
        Assert.Contains("Access denied", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdateStructuredContentAsync_posts_next_version_after_latest_working_version()
    {
        var requests = new List<(HttpMethod Method, string PathAndQuery, string? Body)>();
        var handler = new EventbriteHttpMessageHandler(async (request, cancellationToken) =>
        {
            requests.Add((request.Method, request.RequestUri!.PathAndQuery,
                request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken)));
            var json = request.Method == HttpMethod.Get ? """{"page_version_number":"4","modules":[]}""" : "{}";
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });
        var client = CreateClient(handler, new EventbriteOptions { PrivateToken = "fake-token" });

        using var response = await client.UpdateStructuredContentAsync(
            "event-2", [new JsonObject { ["type"] = "text" }], CancellationToken.None);

        Assert.Equal(2, requests.Count);
        Assert.Equal((HttpMethod.Get, "/v3/events/event-2/structured_content/edit/?purpose=listing"),
            (requests[0].Method, requests[0].PathAndQuery));
        Assert.Equal((HttpMethod.Post, "/v3/events/event-2/structured_content/5/"),
            (requests[1].Method, requests[1].PathAndQuery));
        var body = JsonNode.Parse(requests[1].Body!);
        Assert.True(body?["publish"]?.GetValue<bool>());
        Assert.Equal("text", body?["modules"]?[0]?["type"]?.GetValue<string>());
    }

    [Fact]
    public async Task UpdateStructuredContentAsync_starts_at_version_one_without_existing_content()
    {
        string? postPath = null;
        var handler = new EventbriteHttpMessageHandler((request, _) =>
        {
            if (request.Method == HttpMethod.Get)
            {
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)
                {
                    Content = new StringContent("""{"error":"NOT_FOUND"}""", Encoding.UTF8, "application/json")
                });
            }

            postPath = request.RequestUri!.AbsolutePath;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });
        });
        var client = CreateClient(handler, new EventbriteOptions { PrivateToken = "fake-token" });

        using var response = await client.UpdateStructuredContentAsync("event-2", [], CancellationToken.None);

        Assert.Equal("/v3/events/event-2/structured_content/1/", postPath);
    }

    [Fact]
    public async Task PublishEventAsync_rejects_unsuccessful_publish_result()
    {
        var handler = new EventbriteHttpMessageHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("""{"published":false}""", Encoding.UTF8, "application/json")
        }));
        var client = CreateClient(handler, new EventbriteOptions { PrivateToken = "fake-token" });

        await Assert.ThrowsAsync<EventbriteApiException>(() =>
            client.PublishEventAsync("event-2", CancellationToken.None));
    }

    private static EventbriteApiClient CreateClient(HttpMessageHandler handler, EventbriteOptions options)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://www.eventbriteapi.com/v3/")
        };
        return new EventbriteApiClient(httpClient, Options.Create(options));
    }
}
