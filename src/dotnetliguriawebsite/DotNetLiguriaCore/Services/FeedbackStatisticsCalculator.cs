using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services;

public static class FeedbackStatisticsCalculator
{
    public static WorkshopFeedbackStatistics Calculate(Guid workshopId, string workshopTitle, IReadOnlyList<Feedback> feedbacks)
    {
        var trackStatistics = feedbacks
            .GroupBy(feedback =>
            {
                var title = feedback.TrackTitle ?? "L'evento ha soddisfatto le tue aspettative?";
                return title == "L'evento ha soddisfatto le tue aspettative?"
                    ? title
                    : feedback.WorkshopTrackId.ToString();
            })
            .Select(trackGroup =>
            {
                var trackFeedbacks = trackGroup.ToList();
                var ratingDistribution = new Dictionary<int, int>();
                for (var rating = 0; rating <= 10; rating++)
                    ratingDistribution[rating] = trackFeedbacks.Count(feedback => feedback.Rating == rating);

                var totalFeedbacks = trackFeedbacks.Count;
                var averageRating = totalFeedbacks > 0 ? trackFeedbacks.Average(feedback => feedback.Rating) : 0;
                var trackTitle = trackFeedbacks.FirstOrDefault()?.TrackTitle ?? "L'evento ha soddisfatto le tue aspettative?";
                var workshopTrackId = trackTitle == "L'evento ha soddisfatto le tue aspettative?"
                    ? Guid.Empty
                    : trackFeedbacks.FirstOrDefault()?.WorkshopTrackId ?? Guid.Empty;

                return new TrackFeedbackStatistics
                {
                    WorkshopTrackId = workshopTrackId,
                    TrackTitle = trackTitle,
                    RatingDistribution = ratingDistribution,
                    TotalFeedbacks = totalFeedbacks,
                    AverageRating = Math.Round(averageRating, 2)
                };
            })
            .ToList();

        return new WorkshopFeedbackStatistics
        {
            WorkshopId = workshopId,
            WorkshopTitle = workshopTitle,
            TrackStatistics = trackStatistics,
            Notes = feedbacks.Where(feedback => !string.IsNullOrEmpty(feedback.Note))
                .Select(feedback => feedback.Note!).Distinct().ToList()
        };
    }
}