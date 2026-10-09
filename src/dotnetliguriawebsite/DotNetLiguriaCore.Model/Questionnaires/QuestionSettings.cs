namespace DotNetLiguriaCore.Model;

public class QuestionSettings
{
    public int? MaxLength { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
    public string? MinLabel { get; set; }
    public string? MaxLabel { get; set; }
    public int? MinSelections { get; set; }
    public int? MaxSelections { get; set; }
    public bool AllowOther { get; set; }
    public string? OtherLabel { get; set; }
    public bool UseDropdown { get; set; }
    public string? Placeholder { get; set; }
}
