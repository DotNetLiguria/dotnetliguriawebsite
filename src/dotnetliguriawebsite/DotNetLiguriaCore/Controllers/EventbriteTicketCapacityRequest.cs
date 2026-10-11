using System.ComponentModel.DataAnnotations;

namespace DotNetLiguriaCore.Controllers;

public sealed class EventbriteTicketCapacityRequest
{
    [Range(1, int.MaxValue)]
    public int Capacity { get; set; }
}
