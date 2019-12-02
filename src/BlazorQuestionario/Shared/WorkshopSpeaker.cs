using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlazorAppTest.Shared
{
    public partial class WorkshopSpeaker
    {
        public WorkshopSpeaker()
        {
           
            
        }
        [Key]
        public Guid WorkshopSpeakerId { get; set; }
        public string Name { get; set; }
        public string ProfileImage { get; set; }
        public string BlogHtml { get; set; }
        public string UserName { get; set; }

        
        
    }
}
