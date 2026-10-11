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

    private static EventbriteApiClient CreateClient(HttpMessageHandler handler, EventbriteOptions options)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://www.eventbriteapi.com/v3/")
        };
        return new EventbriteApiClient(httpClient, Options.Create(options));
    }
}
