namespace DotNetLiguriaCore.Model;

public class QuestionStatistics
{
    public string QuestionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public QuestionType Type { get; set; }
    public int AnsweredCount { get; set; }
    public double? Average { get; set; }
    public double? Min { get; set; }
    public double? Max { get; set; }
    public List<ValueCount> Distribution { get; set; } = [];
    public List<OptionCount> Options { get; set; } = [];
    public List<MatrixRowStatistics> Rows { get; set; } = [];
    public List<TextAnswer> TextAnswers { get; set; } = [];
}
