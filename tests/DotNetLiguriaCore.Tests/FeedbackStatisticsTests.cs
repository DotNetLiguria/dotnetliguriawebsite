using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class FeedbackStatisticsTests
{
    [Fact]
    public void EmptyInputPreservesCallerTitleWithoutInventingStatistics()
    {
        var workshopId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var result = FeedbackStatisticsCalculator.Calculate(workshopId, "Unknown Workshop", []);
        Assert.Equal(workshopId, result.WorkshopId);
        Assert.Equal("Unknown Workshop", result.WorkshopTitle);
        Assert.Empty(result.TrackStatistics);
        Assert.Empty(result.Notes);
    }

    [Fact]
    public void RatingsHaveAllElevenBinsAndAverageRoundsToTwoPlaces()
    {
        var result = FeedbackStatisticsCalculator.Calculate(Guid.Empty, "Workshop",
            [new Feedback { Rating = 0 }, new Feedback { Rating = 0 }, new Feedback { Rating = 10 }]);
        var track = Assert.Single(result.TrackStatistics);
        Assert.Equal(Enumerable.Range(0, 11), track.RatingDistribution.Keys.Order());
        Assert.Equal(2, track.RatingDistribution[0]);
        Assert.Equal(1, track.RatingDistribution[10]);
        Assert.Equal(0, track.RatingDistribution[5]);
        Assert.Equal(3, track.TotalFeedbacks);
        Assert.Equal(3.33, track.AverageRating);
    }

    [Fact]
    public void EventAnswersGroupTogetherAndTrackAnswersGroupById()
    {
        var firstId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var secondId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var result = FeedbackStatisticsCalculator.Calculate(Guid.Empty, "Workshop",
        [
            new Feedback { WorkshopTrackId = firstId, TrackTitle = null, Rating = 5 },
            new Feedback { WorkshopTrackId = secondId, TrackTitle = "L'evento ha soddisfatto le tue aspettative?", Rating = 7 },
            new Feedback { WorkshopTrackId = firstId, TrackTitle = "First title", Rating = 10 },
            new Feedback { WorkshopTrackId = firstId, TrackTitle = "Changed title", Rating = 8 },
            new Feedback { WorkshopTrackId = secondId, TrackTitle = "First title", Rating = 3 }
        ]);
        Assert.Equal(3, result.TrackStatistics.Count);
        var eventRating = result.TrackStatistics.Single(track => track.WorkshopTrackId == Guid.Empty);
        Assert.Equal(2, eventRating.TotalFeedbacks);
        Assert.Equal(6, eventRating.AverageRating);
        var firstTrack = result.TrackStatistics.Single(track => track.WorkshopTrackId == firstId);
        Assert.Equal("First title", firstTrack.TrackTitle);
        Assert.Equal(2, firstTrack.TotalFeedbacks);
        Assert.Equal(9, firstTrack.AverageRating);
    }

    [Fact]
    public void NotesExcludeNullAndEmptyButPreserveDistinctWhitespaceAndCase()
    {
        var feedbacks = new string?[] { null, "", "Note", "Note", "note", " " }
            .Select(note => new Feedback { Note = note }).ToList();
        var result = FeedbackStatisticsCalculator.Calculate(Guid.Empty, "Workshop", feedbacks);
        Assert.Equal(["Note", "note", " "], result.Notes);
    }
}