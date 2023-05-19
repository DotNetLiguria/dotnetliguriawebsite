using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace DotNetLiguria.Models
{
    public class WorkshopUndersigned
    {
        public WorkshopUndersigned()
        {
           
        }

        public Guid WorkshopUndersignedId { get; set; }
        public DateTime SignedDate { get; set; }
        public bool CheckIn { get; set; }

        public virtual Workshop? Workshop {get; set;}

        public virtual WorkshopFeedback? Feedback { get; set; }

        public virtual CustomUser? User { get; set; }
    }
}
