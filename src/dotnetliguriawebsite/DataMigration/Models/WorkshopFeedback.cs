using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace DotNetLiguria.Models
{
    public class WorkshopFeedback
    {
        public Guid WorkshopFeedbackId { get; set; }

        public int Vote { get; set; }

        public virtual List<TrackFeedBack>? TracksFeedback { get; set; }
    }
}
