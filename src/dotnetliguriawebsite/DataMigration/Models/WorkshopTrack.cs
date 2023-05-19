using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class WorkshopTrack
    {
        //[Key]
        //[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid WorkshopTrackId { get; set; }

        public string? Title { get; set; }
        public string? Image { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? Abstract { get; set; }
        public int Level { get; set; }

        public virtual ICollection<WorkshopSpeaker> Speakers { get; set; }

        public virtual Guid WorkshopId { get; set; }

        public WorkshopTrack()
        {
            this.Speakers = new List<WorkshopSpeaker>();
        }
    }
}
