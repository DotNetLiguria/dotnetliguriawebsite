namespace DotNetLiguriaCore.Model;

public class MatrixRowStatistics
{
    public string RowId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int AnsweredCount { get; set; }
    public double? Average { get; set; }
    public List<ValueCount> Distribution { get; set; } = [];
}
