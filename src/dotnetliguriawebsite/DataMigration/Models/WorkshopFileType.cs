using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DotNetLiguria.Models
{

    public enum WorkshopFileType
    {
        Image = 1, Photo = 2, Video = 3, Material = 4, Poster = 5, Link = 6, Other = 7
    }
}
