using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class WorkshopSpeaker
    {
        public Guid WorkshopSpeakerId { get; set; }
        public string? Name { get; set; }
        public string? ProfileImage { get; set; }
        public string? BlogHtml { get; set; }
        public string? UserName { get; set; }
        public virtual ICollection<WorkshopTrack>? Tracks { get; set; }

    }
}
