using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;


namespace BlazorAppTest.Shared
{
    public partial class WorkshopTrackWorkshopSpeaker
    {
        //[Key,  Column("WorkshopTrack_WorkshopTrackId")]
        public Guid WorkshopTrackWorkshopTrackId { get; set; }

        //[Column("WorkshopTrack_WorkshopTrackId")]
        public Guid WorkshopSpeakerWorkshopSpeakerId { get; set; }

        public virtual WorkshopSpeaker WorkshopSpeakerWorkshopSpeaker { get; set; }
        public virtual WorkshopTrack WorkshopTrackWorkshopTrack { get; set; }


    }
}
