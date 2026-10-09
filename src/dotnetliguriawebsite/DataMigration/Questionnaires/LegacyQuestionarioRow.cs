using DotNetLiguriaCore.Model;

namespace DataMigration.Questionnaires;

/// <summary>A row of the legacy Blazor QuestionarioTest table (SQL Server or SQLite).</summary>
public class LegacyQuestionarioRow
{
    public ResponseSource Source { get; set; }
    public string Id { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? Name { get; set; }
    public string? Surname { get; set; }
    public string? Email { get; set; }
    public string? Topics { get; set; }
    public string? Suggestions { get; set; }
    public int OverallRating { get; set; }
    public int UsefulnessRating { get; set; }
    public string? WorkshopId { get; set; }
    public List<LegacyTrackRating> Tracks { get; set; } = [];
}
