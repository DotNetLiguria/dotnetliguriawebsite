using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class CustomUser
    {
        public CustomUser()
        {
            this.OfferteLavoro = new List<OffertaLavoro>();
        }

        public string? CustomUserId { get; set; }
        public string? Username { get; set; }
        public string? Email { get; set; }
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Url { get; set; }
        public string? Image { get; set; }

        public DateTime? LastLoginDate { get; set; }

        public DateTime? RegistrationDate { get; set; }

        public virtual WorkshopSpeaker? Speaker { get; set; }

        public virtual ICollection<OffertaLavoro>? OfferteLavoro { get; set; }
    }
}
