namespace DotNetLiguriaCore.Model
{

    public class TrackFeedbackStatistics
    {
        public Guid WorkshopTrackId { get; set; }
        public required string TrackTitle { get; set; }
        public Dictionary<int, int> RatingDistribution { get; set; } = new();
        public int TotalFeedbacks { get; set; }
        public double AverageRating { get; set; }
    }
}
