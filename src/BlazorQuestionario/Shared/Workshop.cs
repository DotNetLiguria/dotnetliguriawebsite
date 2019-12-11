using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlazorAppTest.Shared { 
    public partial class Workshop
    {
        public Workshop()
        {
            
            
            
        }
        [Key]
        public string WorkshopId { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public DateTime CreationDate { get; set; }
        public DateTime EventDate { get; set; }
        public string BlogHtml { get; set; }
        public string Image { get; set; }
        public string Tags { get; set; }
        public bool Published { get; set; }
        public bool IsExternalEvent { get; set; }
        public bool ExternalRegistration { get; set; }
        public string ExternalRegistrationLink { get; set; }
        public bool OnlyHtml { get; set; }

        public virtual ICollection<WorkshopTrack> WorkshopTracks { get; set; }


    }
}
