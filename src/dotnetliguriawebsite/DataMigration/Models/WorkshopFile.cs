using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DotNetLiguria.Models
{
    public class WorkshopFile
    {
        public Guid? WorkshopFileId { get; set; }

        public Guid? Workshop_WorkshopId { get; set; }

        public string FolderName { get; set; } = string.Empty;

        public string? Title { get; set; }
        public string? FileName { get; set; }

        public string? WorkshopFolder { get; set; } = string.Empty;
        public string? FullPath { get; set; }
        public WorkshopFileType? FileType { get; set; }


        [JsonIgnore]
        [ForeignKey("Workshop_WorkshopId")]
        public Workshop? Workshop { get; set; }

    }
}
