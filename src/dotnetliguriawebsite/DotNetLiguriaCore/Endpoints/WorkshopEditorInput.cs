using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Endpoints;

public static class WorkshopEditorInput
{
    public static void Apply(Workshop target, Workshop input)
    {
        target.Title = input.Title;
        target.Description = input.Description;
        target.EventDate = input.EventDate;
        target.BlogHtml = input.BlogHtml;
        target.ImageOld = input.ImageOld;
        target.ImageThumbnail = input.ImageThumbnail;
        target.Image = input.Image;
        target.Tags = input.Tags;
        target.Published = input.Published;
        target.IsExternalEvent = input.IsExternalEvent;
        if (string.IsNullOrWhiteSpace(target.EventbriteEventId))
        {
            target.ExternalRegistration = input.ExternalRegistration;
            target.ExternalRegistrationLink = input.ExternalRegistrationLink;
        }
        target.OnlyHtml = input.OnlyHtml;
        target.Location = input.Location;
        target.Tracks = input.Tracks;
        target.Talks = input.Talks;
        target.AgendaTracks = input.AgendaTracks;
        target.AgendaItems = input.AgendaItems;
        target.AttendeeNotes = input.AttendeeNotes;
        target.BookingServiceUrl = input.BookingServiceUrl;
        target.EventbriteTicketCapacity = input.EventbriteTicketCapacity;
        target.EventbriteSalesStart = input.EventbriteSalesStart;
        target.EventbriteSalesEnd = input.EventbriteSalesEnd;
        target.OldUrl = input.OldUrl;
        target.Slug = input.Slug;
        target.In_homepage = input.In_homepage;
        target.FeedbackEnabled = input.FeedbackEnabled;
    }
}
