using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace DotNetLiguria.Models
{
    public class WorkshopFile
    {
        public Guid WorkshopFileId { get; set; }

        public string Title { get; set; }
        public string FileName { get; set; }
        public string FullPath { get; set; }
        public WorkshopFileType FileType { get; set; }
    }

    public enum WorkshopFileType
    {
        Image = 1, Photo = 2, Video = 3, Material = 4, Poster = 5, Link = 6
    }
}
