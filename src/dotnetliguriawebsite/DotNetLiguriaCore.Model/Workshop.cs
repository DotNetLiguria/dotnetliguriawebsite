using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model
{
    public class Workshop
    {
        [BsonId]
        public Guid WorkshopId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        
        [BsonDateTimeOptions(Kind = DateTimeKind.Local)]
        public DateTime? CreationDate { get; set; }
        
        [BsonDateTimeOptions(Kind = DateTimeKind.Local)]
        public DateTime? EventDate { get; set; }
        
        public string? BlogHtml { get; set; }
        public string? ImageOld { get; set; }
        public string? ImageThumbnail { get; set; }
        public string? Image { get; set; }
        public string? Tags { get; set; }
        public bool? Published { get; set; }
        public bool? IsExternalEvent { get; set; }
        public bool? ExternalRegistration { get; set; }
        public string? ExternalRegistrationLink { get; set; }

        public bool? OnlyHtml { get; set; }

        public Location? Location { get; set; }

        public string? FolderName { get; set; }

        public List<WorkshopTrack>? Tracks { get; set; }
        public List<WorkshopTalk> Talks { get; set; } = [];
        public List<WorkshopAgendaTrack> AgendaTracks { get; set; } = [];
        public List<WorkshopAgendaItem> AgendaItems { get; set; } = [];
        public string? AttendeeNotes { get; set; }
        public string? BookingServiceUrl { get; set; }
        public int EventbriteTicketCapacity { get; set; }
        public int EventbriteSyncedTicketCapacity { get; set; }
        public string? EventbriteSalesStart { get; set; }
        public string? EventbriteSalesEnd { get; set; }
        public string? EventbriteEventId { get; set; }
        public string? EventbriteEventUrl { get; set; }
        public string? EventbriteVenueId { get; set; }
        public string? EventbriteTicketClassId { get; set; }
        public bool EventbritePublished { get; set; }
        public string? EventbriteSyncStatus { get; set; }
        public string? EventbriteLastError { get; set; }
        public DateTime? EventbriteLastSyncedAt { get; set; }

        public string? OldUrl { get; set; }
        public string? Slug { get; set; }

        public bool In_homepage { get; set; }
        public bool FeedbackEnabled { get; set; }
        public List<WorkshopFile> Materials { get; set; } = [];
        public List<WorkshopFile> Photos { get; set; } = [];

    }
}
