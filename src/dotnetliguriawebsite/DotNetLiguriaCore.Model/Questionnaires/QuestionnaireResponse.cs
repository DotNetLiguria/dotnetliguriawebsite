using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model;

[BsonIgnoreExtraElements]
public class QuestionnaireResponse
{
    [BsonId]
    public Guid ResponseId { get; set; }

    public Guid QuestionnaireId { get; set; }
    public int QuestionnaireVersion { get; set; }

    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime SubmittedAt { get; set; }

    public Respondent? Respondent { get; set; }
    public bool ConsentGiven { get; set; }

    public List<QuestionAnswer> Answers { get; set; } = [];

    [BsonRepresentation(BsonType.String)]
    public ResponseSource Source { get; set; } = ResponseSource.Web;

    [BsonIgnoreIfNull]
    public string? SourceKey { get; set; }

    // Set only when the questionnaire allows one response per email; backs a unique index.
    [BsonIgnoreIfNull]
    [System.Text.Json.Serialization.JsonIgnore]
    public string? UniqueEmailKey { get; set; }
}
