using System.ComponentModel.DataAnnotations;

namespace DotNetLiguriaCore.Endpoints;

public sealed class EventbriteTicketCapacityRequest
{
    [Range(1, int.MaxValue)]
    public int Capacity { get; set; }
}
