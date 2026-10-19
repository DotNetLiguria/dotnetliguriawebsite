using System.Text.Json;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Authorization;

public static class EventChangePermissions
{
    public static IReadOnlySet<string> Required(Workshop? current, Workshop proposed)
    {
        var permissions = new HashSet<string>(StringComparer.Ordinal);
        if (proposed.Published == true && current?.Published != true ||
            current?.Published == true && proposed.Published != true ||
            current?.Published == true && JsonSerializer.Serialize(PublicWorkshopProjection.From(current)) !=
                JsonSerializer.Serialize(PublicWorkshopProjection.From(proposed)))
            permissions.Add("events.publish");
        if (proposed.In_homepage != (current?.In_homepage ?? false)) permissions.Add("events.homepage.manage");
        if (proposed.FeedbackEnabled != (current?.FeedbackEnabled ?? false)) permissions.Add("questionnaires.manage");
        if (proposed.EventbriteTicketCapacity != (current?.EventbriteTicketCapacity ?? 0) ||
            proposed.EventbriteSalesStart != current?.EventbriteSalesStart ||
            proposed.EventbriteSalesEnd != current?.EventbriteSalesEnd)
            permissions.Add("eventbrite.manage");
        if (current is not null && (proposed.Image != current.Image ||
            proposed.ImageThumbnail != current.ImageThumbnail || proposed.ImageOld != current.ImageOld))
            permissions.Add("event-assets.manage");
        return permissions;
    }
}
