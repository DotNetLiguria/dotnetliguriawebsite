namespace DataMigration
{
    public class DotNetLiguriaDatabaseSettings
    {
        public string ConnectionString { get; set; } = null!;

        public string DatabaseName { get; set; } = null!;

        public string WorkshopCollectionName { get; set; } = null!;
        public string SpeakerCollectionName { get; set; } = null!;

        public string WorkshopFileCollectionName { get; set; } = null!;

        public string FileTypeCollectionName { get; set; } = null!;

        public string BoardCollectionName { get; set; } = null!;

        public string FeedbackCollectionName { get; set; } = "Feedback";

        public string QuestionnaireCollectionName { get; set; } = "Questionnaire";

        public string QuestionnaireResponseCollectionName { get; set; } = "QuestionnaireResponse";
    }
}
