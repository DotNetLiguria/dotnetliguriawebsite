using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Models
{
    public class Workshop
    {
        public Guid WorkshopId { get; set; }

        public string? Title { get; set; }
        public string? Description { get; set; }
        public DateTime? CreationDate { get; set; }
        public DateTime? EventDate { get; set; }
        public string? BlogHtml { get; set; }
        public string? Image { get; set; }
        public string? Tags { get; set; }
        public bool? Published { get; set; }
        public bool? IsExternalEvent { get; set; }
        public bool? ExternalRegistration { get; set; }
        public string? ExternalRegistrationLink { get; set; }

        public bool? OnlyHtml { get; set; }

        public LocationModels? Location { get; set; }

        public virtual List<WorkshopTrack>? Tracks { get; set; }

        public virtual List<WorkshopFile>? WorkshopFiles { get; set; }

        public virtual List<WorkshopUndersigned>? Workshopsubscribed { get; set; }

        public Workshop()
        {

        }
    }

    public class LocationModels
    {
        public LocationModels()
        {
            this.Coordinates = "0,0";
        }

        public string? Name { get; set; }
        public string? Coordinates { get; set; }
        public string? Address { get; set; }
        public int MaximumSpaces { get; set; }
    }

}