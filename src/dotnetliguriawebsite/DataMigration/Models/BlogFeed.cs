using System;
using System.Collections.Generic;

namespace DotNetLiguria.Models
{
    public class BlogFeed
    {
        public string? Name { get; set; }
        public string? Id { get; set; }
        public string? Title { get; set; }
        public string? Summary { get; set; }
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public string? ExtraImageUrl { get; set; }
        public string? MediaUrl { get; set; }
        public string? FeedUrl { get; set; }
        public string? Author { get; set; }
        public DateTime PublishDate { get; set; }

        public string? DefaultSummary { get; set; }
    }
}
