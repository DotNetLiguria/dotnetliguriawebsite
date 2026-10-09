namespace DotNetLiguriaCore.Model;

public class MatrixRow
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? WorkshopTrackId { get; set; }
}
