using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Endpoints;

public static class PublicWorkshopProjection
{
    public static object From(Workshop workshop) => new
    {
        workshop.WorkshopId,
        workshop.Title,
        workshop.Description,
        workshop.EventDate,
        workshop.BlogHtml,
        workshop.Image,
        workshop.ImageThumbnail,
        workshop.Tags,
        workshop.Published,
        workshop.OnlyHtml,
        workshop.IsExternalEvent,
        workshop.ExternalRegistration,
        workshop.ExternalRegistrationLink,
        workshop.BookingServiceUrl,
        workshop.AttendeeNotes,
        workshop.OldUrl,
        workshop.Slug,
        Location = workshop.Location is { } location ? new
        {
            location.Name, location.Coordinates, location.Address, location.GoogleMapsUrl,
            location.MaximumSpaces, location.Rooms,
        } : null,
        workshop.FeedbackEnabled,
        Tracks = workshop.Tracks?.Select(track => new
        {
            track.WorkshopTrackId, track.Title, track.Image, track.StartTime, track.EndTime,
            track.Abstract, track.Level, track.Speakers, track.SpeakersDetails, track.SpeakersName,
        }),
        Talks = workshop.Talks?.Select(talk => new
        {
            talk.WorkshopTalkId, talk.TrackId, talk.Title, talk.Abstract, talk.SessionType,
            Speakers = talk.Speakers?.Select(speaker => new
            {
                speaker.WorkshopSpeakerId, speaker.Name, speaker.ImageUrl, speaker.Biography,
            }),
        }),
        AgendaTracks = workshop.AgendaTracks?.Select(track => new
        {
            track.WorkshopAgendaTrackId, track.Name, track.Order,
        }),
        AgendaItems = workshop.AgendaItems?.Select(item => new
        {
            item.WorkshopAgendaItemId, item.ItemType, item.TalkId, item.TrackId, item.Order,
            item.Title, item.RoomName, item.StartTime, item.EndTime,
        }),
        Materials = workshop.Materials?.Select(File),
        Photos = workshop.Photos?.Select(File),
    };

    private static object File(WorkshopFile file) => new
    {
        file.WorkshopFileId, file.WorkshopId, file.Title, file.FileName, file.FullPath, file.FileType,
    };
}
