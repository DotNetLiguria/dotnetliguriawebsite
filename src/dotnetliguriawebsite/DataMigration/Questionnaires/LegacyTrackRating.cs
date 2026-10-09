namespace DataMigration.Questionnaires;

/// <summary>One of the fixed TrackNN slots (1-5) of a legacy QuestionarioTest row.</summary>
public class LegacyTrackRating
{
    public int Slot { get; set; }
    public string? WorkshopTrackId { get; set; }
    public int Rating { get; set; }
}
