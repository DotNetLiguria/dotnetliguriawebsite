namespace DotNetLiguriaCore.Model
{
    public class WorkshopFeedbackStatistics
    {
        public Guid WorkshopId { get; set; }
        public required string WorkshopTitle { get; set; }
        public required List<TrackFeedbackStatistics> TrackStatistics { get; set; }
        public List<string> Notes { get; set; } = new();
    }
}
