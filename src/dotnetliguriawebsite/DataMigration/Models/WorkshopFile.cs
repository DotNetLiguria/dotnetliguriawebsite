using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;

namespace DotNetLiguria.Models
{
    public class WorkshopFile
    {
        public Guid WorkshopFileId { get; set; }

        public string? Title { get; set; }
        public string? FileName { get; set; }
        public string? FullPath { get; set; }
        public WorkshopFileType? FileType { get; set; }

        //public Guid? Workshop_WorkshopId { get; set; }
        //public virtual Guid WorkshopId { get; set; }

        [JsonIgnore]
        [ForeignKey("Workshop_WorkshopId")]
        public Workshop? Workshop { get; set; }

    }

    public enum WorkshopFileType
    {
        Image = 1, Photo = 2, Video = 3, Material = 4, Poster = 5, Link = 6
    }
}
