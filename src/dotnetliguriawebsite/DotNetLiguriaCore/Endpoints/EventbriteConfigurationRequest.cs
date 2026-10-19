using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Endpoints;

public sealed record EventbriteConfigurationRequest(string? SalesStart, string? SalesEnd, int? TicketCapacity = null)
{
    public void ApplyTo(Workshop workshop)
    {
        if (workshop.EventbriteSyncStatus is "creating-event" or "creating-ticket" or "reconciliation-required")
            throw new PrivacyBlockedException("eventbrite_reconciliation_required", 409);
        if (TicketCapacity is < 0 || TicketCapacity < workshop.EventbriteSyncedTicketCapacity)
            throw new PrivacyBlockedException("eventbrite_capacity_invalid", 400);
        if (TicketCapacity is { } capacity && capacity != workshop.EventbriteTicketCapacity &&
            !string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
            throw new PrivacyBlockedException("eventbrite_capacity_requires_live_verification", 409);
        if (TicketCapacity is { } initialCapacity) workshop.EventbriteTicketCapacity = initialCapacity;
        workshop.EventbriteSalesStart = string.IsNullOrWhiteSpace(SalesStart) ? null : SalesStart;
        workshop.EventbriteSalesEnd = string.IsNullOrWhiteSpace(SalesEnd) ? null : SalesEnd;
        if (!string.IsNullOrWhiteSpace(workshop.EventbriteEventId))
        {
            workshop.EventbriteSyncStatus = "update-pending";
            workshop.EventbriteLastError = null;
        }
    }
}
