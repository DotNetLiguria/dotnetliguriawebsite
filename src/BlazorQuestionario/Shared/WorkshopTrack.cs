using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlazorAppTest.Shared
{
    public partial class WorkshopTrack
    {
        public WorkshopTrack()
        {
            
        }
        [Key]
        public Guid WorkshopTrackId { get; set; }
        public string Title { get; set; }
        public string Image { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string Abstract { get; set; }
        public int Level { get; set; }
        public Guid WorkshopId { get; set; }

        public virtual Workshop Workshop { get; set; }
        public virtual ICollection<WorkshopTrackWorkshopSpeaker> WorkshopTrackWorkshopSpeaker { get; set; }
    }
}
