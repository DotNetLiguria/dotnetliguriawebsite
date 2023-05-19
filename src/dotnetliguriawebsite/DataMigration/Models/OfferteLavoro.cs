using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class OffertaLavoro
    {
        public Guid OffertaLavoroId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public DateTime CreationDate { get; set; }
        public string? Logo { get; set; }
        public string? Link { get; set; }
        public bool Enable { get; set; }
        public string? BlogHtml { get; set; }
        public string? Azienda { get; set; }
        public string? Luogo { get; set; }
        public virtual CustomUser? User { get; set; }
    }
}
