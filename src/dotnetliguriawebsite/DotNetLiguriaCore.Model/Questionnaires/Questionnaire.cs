using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

[BsonIgnoreExtraElements]
public class Questionnaire
{
    [BsonId]
    public Guid QuestionnaireId { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? IntroText { get; set; }
    public string? ThankYouText { get; set; }

    [BsonRepresentation(BsonType.String)]
    public QuestionnaireStatus Status { get; set; } = QuestionnaireStatus.Draft;

    [BsonRepresentation(BsonType.String)]
    public RespondentMode RespondentMode { get; set; } = RespondentMode.Anonymous;

    public bool OnePerEmail { get; set; }
    public string? ConsentText { get; set; }

    [BsonRepresentation(BsonType.String)]
    public QuestionnaireDisplayMode DisplayMode { get; set; } = QuestionnaireDisplayMode.SinglePage;

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? OpensAt { get; set; }

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ClosesAt { get; set; }

    public Guid? WorkshopId { get; set; }

    public List<QuestionnaireSection> Sections { get; set; } = [];

    public int Version { get; set; } = 1;
    public string? CreatedBy { get; set; }

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; }

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; }

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? PublishedAt { get; set; }

    [BsonRepresentation(BsonType.String)]
    public ResponseSource Origin { get; set; } = ResponseSource.Web;

    // Computed by the API; structure is locked when greater than zero.
    [BsonIgnore]
    public long ResponseCount { get; set; }
}
