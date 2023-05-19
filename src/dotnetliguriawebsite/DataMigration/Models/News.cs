using System;

namespace DotNetLiguria.Models
{
    public class News
    {
        public Guid NewsId { get; set; }

        public string? Title { get; set; }
        public string? Url { get; set; }
        public string? Image { get; set; }
        public string? Tags { get; set; }
        public bool Enable { get; set; }
    }
}
