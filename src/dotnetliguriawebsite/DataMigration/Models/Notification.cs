using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class Notification
    {
        public Guid NotificationId { get; set; }
        public DateTime Timestamp { get; set; }
        public NotificationType NotificationTypeId { get; set; }
        public string? Description { get; set; }

        public virtual CustomUser? User { get; set; }
    }

    public enum NotificationType
    {
        WorkshopUndersigned,
        RemoveUndersigned,
        CheckIn,
        Feedback
    }
}
