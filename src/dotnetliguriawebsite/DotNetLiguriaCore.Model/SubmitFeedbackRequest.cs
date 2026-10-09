namespace DotNetLiguriaCore.Model
{
    public class SubmitFeedbackRequest
    {
        public Guid WorkshopId { get; set; }
        public required List<SubmitFeedbackTrackRequest> TrackFeedbacks { get; set; }
        public string? Note { get; set; }
    }
}
