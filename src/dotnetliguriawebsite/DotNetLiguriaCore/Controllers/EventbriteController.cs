using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]/[action]")]
[ApiController]
[Authorize(Policy = QuestionnaireAuthorizationOptions.PolicyName)]
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

        workshop.EventbriteTicketCapacity = request.Capacity;
        await workshopService.UpdateAsync(id, workshop);
        try
        {
            await integrationService.SyncIfReadyAsync(workshop, cancellationToken);
        }
        catch (EventbriteApiException exception)
        {
            return Problem(
                detail: $"The requested capacity was saved locally, but Eventbrite could not be updated: {exception.Message}",
                statusCode: StatusCodes.Status502BadGateway,
                title: "Eventbrite ticket update failed");
        }
        catch (InvalidOperationException exception)
        {
            return Problem(
                detail: $"The requested capacity was saved locally, but Eventbrite needs attention: {exception.Message}",
                statusCode: StatusCodes.Status409Conflict,
                title: "Eventbrite ticket update needs attention");
        }

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
