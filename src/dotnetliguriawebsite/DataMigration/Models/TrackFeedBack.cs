using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace DotNetLiguria.Models
{

    public class TrackFeedBack
    {
        public Guid TrackFeedBackId { get; set; }

        public virtual WorkshopFeedback? Workshopsubscribed { get; set; }

        public virtual Guid WorkshopTrackId { get; set; }

        public int Vote { get; set; }
    }
}
