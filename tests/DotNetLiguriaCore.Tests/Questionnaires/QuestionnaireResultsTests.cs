using System.Text.Json;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using Xunit;
using static DotNetLiguriaCore.Tests.Questionnaires.QuestionnaireSamples;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class QuestionnaireResultsTests
{
    private static readonly DateTime _day = new(2025, 5, 1, 9, 0, 0, DateTimeKind.Utc);

    public QuestionnaireResultsTests()
    {
        BsonCompatibility.Configure();
    }

    [Fact]
    public void StatisticsAggregateEveryQuestionType()
    {
        var other = Choice("lang", QuestionType.MultipleChoice);
        other.Settings = new QuestionSettings { AllowOther = true };
        var questionnaire = Create(Simple("stars", QuestionType.Rating), other, Matrix("tracks"), Simple("note", QuestionType.LongText));
        var responses = new List<QuestionnaireResponse>
        {
            Response(0, Answer("stars", number: 5), WithOther(Answer("lang", choices: ["a", QuestionnaireRules.OtherOptionId]), "F#"),
                Rows(("r1", 4), ("r2", 2)), Answer("note", text: "Ottimo")),
            Response(1, Answer("stars", number: 3), Answer("lang", choices: "a"), Rows(("r1", 2))),
        };

        var statistics = QuestionnaireStatisticsCalculator.Calculate(questionnaire, responses);

        Assert.Equal(2, statistics.ResponseCount);
        Assert.Equal(2, statistics.ResponsesPerDay.Count);
        var stars = statistics.Questions[0];
        Assert.Equal(4, stars.Average);
        Assert.Equal([0, 0, 1, 0, 1], stars.Distribution.Select(d => d.Count));
        var lang = statistics.Questions[1];
        Assert.Equal([2, 0, 0, 1], lang.Options.Select(o => o.Count));
        Assert.Equal("F#", Assert.Single(lang.TextAnswers).Text);
        var tracks = statistics.Questions[2];
        Assert.Equal(3, tracks.Rows[0].Average);
        Assert.Equal(1, tracks.Rows[1].AnsweredCount);
        Assert.Equal("Ottimo", Assert.Single(statistics.Questions[3].TextAnswers).Text);
    }

    [Fact]
    public void CsvExportsLabelsQuotesAndNeutralisesFormulas()
    {
        var questionnaire = Create(Choice("pick"), Matrix("tracks", required: false), Simple("note", QuestionType.LongText));
        questionnaire.Sections[0].Questions[0].Title = "Scelta";
        var responses = new[]
        {
            Response(0, Answer("pick", choices: "b"), Rows(("r2", 5)), Answer("note", text: "=HYPERLINK(\"x\"), ok")),
        };

        var csv = QuestionnaireCsvExporter.Export(questionnaire, responses);
        var lines = csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("ResponseId,SubmittedAtUtc,Source,Scelta,tracks [Row 1],tracks [Row 2],note", lines[0]);
        Assert.EndsWith(",B,,5,\"'=HYPERLINK(\"\"x\"\"), ok\"", lines[1]);
    }

    [Fact]
    public void StructureComparisonIgnoresTextsButNotIds()
    {
        var original = Create(Choice("c"), Matrix("m"));
        var texts = Create(Choice("c"), Matrix("m"));
        texts.Sections[0].Questions[0].Title = "Altro titolo";
        texts.Sections[0].Questions[1].Rows[0].Label = "Altra riga";
        var removedRow = Create(Choice("c"), Matrix("m"));
        removedRow.Sections[0].Questions[1].Rows.RemoveAt(0);
        var changedType = Create(Choice("c", QuestionType.MultipleChoice), Matrix("m"));

        Assert.True(QuestionnaireStructure.IsCompatible(original, texts));
        Assert.False(QuestionnaireStructure.IsCompatible(original, removedRow));
        Assert.False(QuestionnaireStructure.IsCompatible(original, changedType));
    }

    [Fact]
    public void EnumsSerializeAsStringsInJsonAndBson()
    {
        var questionnaire = Create(Simple("q", QuestionType.Scale));
        questionnaire.Status = QuestionnaireStatus.Published;
        questionnaire.ResponseCount = 7;

        var json = JsonSerializer.Serialize(questionnaire, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var bson = questionnaire.ToBsonDocument();
        var copy = BsonSerializer.Deserialize<Questionnaire>(bson);

        Assert.Contains("\"status\":\"Published\"", json);
        Assert.Contains("\"type\":\"Scale\"", json);
        Assert.Equal("Published", bson["Status"].AsString);
        Assert.False(bson.Contains("ResponseCount"));
        Assert.Equal(BsonBinarySubType.UuidLegacy, bson["_id"].AsBsonBinaryData.SubType);
        Assert.Equal(questionnaire.QuestionnaireId, copy.QuestionnaireId);
        Assert.Equal(QuestionType.Scale, copy.Sections[0].Questions[0].Type);
    }

    [Fact]
    public void ResponseBsonOmitsEmptyAnswerFieldsAndHidesUniqueKeyFromJson()
    {
        var response = Response(0, Answer("q", number: 3));
        response.UniqueEmailKey = "key";

        var answer = response.ToBsonDocument()["Answers"][0].AsBsonDocument;
        var json = JsonSerializer.Serialize(response);

        Assert.Equal(["QuestionId", "Number"], answer.Names);
        Assert.DoesNotContain("UniqueEmailKey", json);
    }

    [Fact]
    public void WebResponseBsonOmitsNullSourceKeySoTheSparseUniqueIndexIgnoresIt()
    {
        var web = Response(0).ToBsonDocument();
        var legacy = Response(0);
        legacy.SourceKey = "LegacyFeedback:abc";

        Assert.False(web.Contains("SourceKey"));
        Assert.False(web.Contains("UniqueEmailKey"));
        Assert.Equal("LegacyFeedback:abc", legacy.ToBsonDocument()["SourceKey"].AsString);
    }

    private static QuestionnaireResponse Response(int dayOffset, params QuestionAnswer[] answers) => new()
    {
        ResponseId = Guid.NewGuid(),
        QuestionnaireId = Guid.Parse("11111111-2222-3333-4444-555555555555"),
        SubmittedAt = _day.AddDays(dayOffset),
        Answers = answers.ToList(),
    };

    private static QuestionAnswer WithOther(QuestionAnswer answer, string text)
    {
        answer.OtherText = text;
        return answer;
    }

    private static QuestionAnswer Rows(params (string Row, int Value)[] values) => new()
    {
        QuestionId = "tracks",
        Rows = values.Select(v => new MatrixAnswer { RowId = v.Row, Value = v.Value }).ToList(),
    };
}
