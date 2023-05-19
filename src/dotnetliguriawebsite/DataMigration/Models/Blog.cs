using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Models
{
    public class Blog
    {
        public Guid BlogId { get; set; }

        public string? Title { get; set; }
        public string? Url { get; set; }
        public string? Image { get; set; }
        public string? Tags { get; set; }
        public bool Enable { get; set; }
    }
}
