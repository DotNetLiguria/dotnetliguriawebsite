using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]/[action]")]
[ApiController]
[Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
public sealed class EventbriteController(
    WorkshopService workshopService,
    EventbriteIntegrationService integrationService,
    EventbriteApiClient apiClient) : ControllerBase
{
    [HttpPost("{id:guid}")]
    public async Task<ActionResult<Workshop>> Sync(Guid id, CancellationToken cancellationToken)
    {
        var workshop = await workshopService.GetAsync(id);
        if (workshop is null)
        {
            return NotFound();
        }

        try
        {
            await integrationService.SyncIfReadyAsync(workshop, cancellationToken);
        }
        catch (EventbriteApiException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Eventbrite synchronization failed");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status409Conflict,
                title: "Eventbrite synchronization needs attention");
        }
        catch (ArgumentException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid Eventbrite event data");
        }

        return Ok(await workshopService.GetAsync(id));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<EventbriteTicketSales>> TicketSales(Guid id, CancellationToken cancellationToken)
    {
        var workshop = await workshopService.GetAsync(id);
        if (workshop is null)
        {
            return NotFound();
        }

        try
        {
            return Ok(await integrationService.GetTicketSalesAsync(workshop, cancellationToken));
        }
        catch (EventbriteApiException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Could not refresh Eventbrite ticket sales");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status409Conflict,
                title: "Eventbrite ticket sales are not available");
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Workshop>> SetTicketCapacity(
        Guid id,
        EventbriteTicketCapacityRequest request,
        CancellationToken cancellationToken)
    {
        var workshop = await workshopService.GetAsync(id);
        if (workshop is null)
        {
            return NotFound();
        }
        if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) ||
            string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Eventbrite tickets are not ready",
                Detail = "Create and synchronize the Eventbrite draft before changing its ticket capacity.",
                Status = StatusCodes.Status409Conflict
            });
        }
        if (request.Capacity < workshop.EventbriteSyncedTicketCapacity)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Ticket capacity cannot be reduced",
                Detail = $"Capacity must be at least the current total of {workshop.EventbriteSyncedTicketCapacity}.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        EventbriteTicketSales liveSales;
        try
        {
            liveSales = await integrationService.GetTicketSalesAsync(workshop, cancellationToken);
        }
        catch (EventbriteApiException exception)
        {
            return Problem(
                detail: $"Capacity was not changed because current Eventbrite ticket sales could not be verified: {exception.Message}",
                statusCode: StatusCodes.Status502BadGateway,
                title: "Could not verify Eventbrite ticket capacity");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status409Conflict,
                title: "Eventbrite ticket capacity is not available");
        }
        if (request.Capacity < liveSales.Sold + liveSales.Pending)
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Capacity is below sold and pending tickets",
                Detail = $"Capacity must be at least {liveSales.Sold + liveSales.Pending} (sold: {liveSales.Sold}, pending: {liveSales.Pending}).",
                Status = StatusCodes.Status400BadRequest
            });
        }

        workshop.EventbriteTicketCapacity = request.Capacity;
        workshop.EventbriteSyncStatus = "update-pending";
        workshop.EventbriteLastError = null;
        await workshopService.UpdateEventbriteAsync(workshop);
        return Ok(await workshopService.GetAsync(id));
    }

    [HttpPost("{id:guid}")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken cancellationToken)
    {
        var workshop = await workshopService.GetAsync(id);
        if (workshop is null)
        {
            return NotFound();
        }
        if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) ||
            string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId) ||
            workshop.EventbriteSyncStatus != "synced")
        {
            return Conflict(new ProblemDetails
            {
                Title = "Eventbrite draft is not ready to publish",
                Detail = "Synchronize the event and its free ticket before publishing.",
                Status = StatusCodes.Status409Conflict
            });
        }
        if (workshop.EventbritePublished)
        {
            return Conflict(new ProblemDetails
            {
                Title = "Eventbrite event is already published",
                Status = StatusCodes.Status409Conflict
            });
        }

        try
        {
            using var response = await apiClient.PublishEventAsync(workshop.EventbriteEventId, cancellationToken);
            workshop.EventbritePublished = true;
            await workshopService.UpdateEventbriteAsync(workshop);
        }
        catch (EventbriteApiException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway,
                title: "Eventbrite publishing failed");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable,
                title: "Eventbrite integration is not configured");
        }

        return NoContent();
    }
}
