using System.Data;

using DataMigration.Questionnaires;

using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;

using Xunit;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class QuestionnaireMigrationTests
{
    private static readonly DateTime _now = new(2025, 6, 1, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime _eventDay = new(2024, 3, 15, 18, 0, 0, DateTimeKind.Utc);
    private static readonly Guid _workshopId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid _trackA = Guid.Parse("bbbbbbbb-0000-0000-0000-00000000000a");
    private static readonly Guid _trackB = Guid.Parse("bbbbbbbb-0000-0000-0000-00000000000b");

    [Fact]
    public void DeterministicGuidIsStableDistinctAndVersion8()
    {
        var first = DeterministicGuid.Create("LegacyFeedback:1");

        Assert.Equal(first, DeterministicGuid.Create("LegacyFeedback:1"));
        Assert.NotEqual(first, DeterministicGuid.Create("LegacyFeedback:2"));
        Assert.Equal('8', first.ToString()[14]);
    }

    [Fact]
    public void GrouperSplitsSubmissionsByNoteTimeWindowAndRepeatedSlot()
    {
        var rows = new[]
        {
            Feedback(1, _trackA, 5, "ottimo", 0),
            Feedback(2, _trackB, 4, "ottimo", 1),
            Feedback(3, _trackA, 3, "ottimo", 2), // repeated track: second submission
            Feedback(4, _trackA, 2, "male", 2),   // different note
            Feedback(5, _trackB, 1, "ottimo", 60), // outside the window
        };

        var (groups, ambiguous) = LegacyFeedbackGrouper.Group(rows, f => f.WorkshopTrackId.ToString(), TimeSpan.FromSeconds(5));

        Assert.Equal([[5, 4], [3], [2], [1]], groups.Select(g => g.Select(f => f.Rating).ToArray()));
        Assert.Equal(0, ambiguous);
    }

    [Fact]
    public void FeedbackMapperBuildsClosedHistoricalQuestionnaireWithOverallMatrixAndNote()
    {
        var overallTrack = Guid.NewGuid(); // synthetic "Tutti" track: random id, no TrackTitle
        var rows = new List<Feedback>
        {
            Feedback(1, _trackA, 5, " Bravi ", 0, "Sessione A"),
            Feedback(2, _trackB, 4, " Bravi ", 0.5, "Sessione B"),
            Feedback(3, overallTrack, 4, " Bravi ", 1),
            Feedback(4, _trackA, 3, null, 30, "Sessione A"),
            Feedback(5, Guid.NewGuid(), 2, null, 30.2),
        };

        var batch = LegacyFeedbackMapper.Map(_workshopId, Workshop(), rows, _now);
        var questionnaire = batch.Questionnaire;
        var questionIds = questionnaire.Sections.SelectMany(s => s.Questions).Select(q => q.Id).ToList();

        Assert.Equal(DeterministicGuid.Create($"LegacyFeedback|{_workshopId:N}"), questionnaire.QuestionnaireId);
        Assert.Equal(QuestionnaireStatus.Closed, questionnaire.Status);
        Assert.Equal(ResponseSource.LegacyFeedback, questionnaire.Origin);
        Assert.Equal(_workshopId, questionnaire.WorkshopId);
        Assert.Equal("Feedback (storico) - Workshop di prova", questionnaire.Title);
        Assert.Equal(["overall", "tracks", "suggestions"], questionIds);
        Assert.All(questionnaire.Sections.SelectMany(s => s.Questions), q => Assert.False(q.Required));
        Assert.Equal(QuestionType.Rating, questionnaire.Sections[0].Questions[0].Type);
        Assert.Empty(QuestionnaireDefinitionValidator.Validate(questionnaire, forPublish: true));

        Assert.Equal(2, batch.Responses.Count);
        var first = batch.Responses[0];
        Assert.Equal($"LegacyFeedback:{rows[0].FeedbackId:N}", first.SourceKey);
        Assert.Equal(DeterministicGuid.Create(first.SourceKey!), first.ResponseId);
        Assert.Equal(_eventDay, first.SubmittedAt);
        Assert.Equal(4, first.Answers.Single(a => a.QuestionId == "overall").Number);
        Assert.Equal("Bravi", first.Answers.Single(a => a.QuestionId == "suggestions").Text);
        Assert.Equal([5, 4], first.Answers.Single(a => a.QuestionId == "tracks").Rows!.Select(r => r.Value));
        Assert.DoesNotContain(batch.Responses[1].Answers, a => a.QuestionId == "suggestions");

        var stats = QuestionnaireStatisticsCalculator.Calculate(questionnaire, batch.Responses);
        Assert.Equal(2, stats.ResponseCount);
        Assert.Equal(4, stats.Questions.Single(q => q.QuestionId == "tracks").Rows.Single(r => r.RowId == _trackA.ToString("N")).Average);
    }

    [Fact]
    public void FeedbackMapperIsIdempotentAndUsesScaleWhenZeroWasRecorded()
    {
        var rows = new List<Feedback> { Feedback(1, _trackA, 0, null, 0, "Sessione A"), Feedback(2, _trackB, 8, null, 1, "Sessione B") };

        var first = LegacyFeedbackMapper.Map(_workshopId, Workshop(), rows, _now);
        var second = LegacyFeedbackMapper.Map(_workshopId, Workshop(), rows, _now.AddDays(1));
        var overall = first.Questionnaire.Sections[0].Questions[0];

        Assert.Equal(first.Questionnaire.QuestionnaireId, second.Questionnaire.QuestionnaireId);
        Assert.Equal(first.Responses.Select(r => r.ResponseId), second.Responses.Select(r => r.ResponseId));
        Assert.Equal(QuestionType.Scale, overall.Type);
        Assert.Equal(0, overall.Settings.Min);
        Assert.Equal(8, overall.Settings.Max);
    }

    [Fact]
    public void FeedbackMapperKeepsTracksOfMissingWorkshopsAndWarns()
    {
        var rows = new List<Feedback> { Feedback(1, _trackA, 4, null, 0, "Sessione A"), Feedback(2, Guid.NewGuid(), 5, null, 1) };

        var batch = LegacyFeedbackMapper.Map(_workshopId, null, rows, _now);
        var matrix = batch.Questionnaire.Sections.SelectMany(s => s.Questions).Single(q => q.Id == "tracks");

        Assert.Equal(["Sessione A"], matrix.Rows.Select(r => r.Label));
        Assert.Equal(5, batch.Responses.Single().Answers.Single(a => a.QuestionId == "overall").Number);
        Assert.Single(batch.Warnings);
        Assert.Equal("Feedback (storico) - Workshop di prova", batch.Questionnaire.Title);
    }

    [Fact]
    public void SqlServerMapperPreservesPerSlotScalesRespondentAndSuggestions()
    {
        var row = Questionario(ResponseSource.LegacySqlServer, "r1", overall: 5, usefulness: 4);
        row.Tracks = [Track(1, _trackA, 3), Track(4, _trackB, 9), Track(2, null, 0), Track(3, Guid.Empty.ToString(), 0)];
        row.Suggestions = "  Più demo ";
        var outOfRange = Questionario(ResponseSource.LegacySqlServer, "r2", overall: 7, usefulness: 3);

        var batch = LegacyQuestionarioMapper.Map(ResponseSource.LegacySqlServer, _workshopId.ToString("N"), Workshop(), [row, outOfRange], _now);
        var questions = batch.Questionnaire.Sections.SelectMany(s => s.Questions).ToDictionary(q => q.Id);
        var trackA = LegacyQuestionarioMapper.TrackQuestionId(_trackA.ToString("N"));
        var trackB = LegacyQuestionarioMapper.TrackQuestionId(_trackB.ToString("N"));

        Assert.Equal(ResponseSource.LegacySqlServer, batch.Questionnaire.Origin);
        Assert.Equal(RespondentMode.Identified, batch.Questionnaire.RespondentMode);
        Assert.Equal(_workshopId, batch.Questionnaire.WorkshopId);
        Assert.Equal("Questionario (storico SQL Server) - Workshop di prova", batch.Questionnaire.Title);
        Assert.Equal(["overall", "usefulness", trackA, trackB, "topics", "suggestions"], questions.Keys);
        Assert.Equal((0d, 5d), (questions["overall"].Settings.Min!.Value, questions["overall"].Settings.Max!.Value));
        Assert.Equal(5, questions[trackA].Settings.Max);
        Assert.Equal(10, questions[trackB].Settings.Max);
        Assert.Equal("Sessione A", questions[trackA].Title);
        Assert.Equal("Mario Rossi", questions[trackA].HelpText);
        Assert.Empty(QuestionnaireDefinitionValidator.Validate(batch.Questionnaire, forPublish: true));

        var response = batch.Responses[0];
        Assert.Equal("LegacySqlServer:r1", response.SourceKey);
        Assert.Equal("mario@example.com", response.Respondent!.EmailNormalized);
        Assert.Equal("Mario@Example.com", response.Respondent.Email);
        Assert.Equal(9, response.Answers.Single(a => a.QuestionId == trackB).Number);
        Assert.Equal("Più demo", response.Answers.Single(a => a.QuestionId == "suggestions").Text);
        Assert.DoesNotContain(batch.Responses[1].Answers, a => a.QuestionId == "overall");
        Assert.Contains(batch.Warnings, w => w.Contains("fuori scala"));
    }

    [Fact]
    public void SqliteMapperUsesZeroToTenWithoutSuggestionsAndWarnsForUnknownWorkshop()
    {
        var row = Questionario(ResponseSource.LegacySqlite, "abc", overall: 9, usefulness: 10);
        row.Tracks = [Track(1, _trackA, 8)];

        var batch = LegacyQuestionarioMapper.Map(ResponseSource.LegacySqlite, "unknown", null, [row], _now);
        var questions = batch.Questionnaire.Sections.SelectMany(s => s.Questions).ToList();

        Assert.Equal(10, questions[0].Settings.Max);
        Assert.Equal("Sessione 1", questions[2].Title);
        Assert.DoesNotContain(questions, q => q.Id == "suggestions");
        Assert.Null(batch.Questionnaire.WorkshopId);
        Assert.Single(batch.Warnings);
        Assert.Equal(["overall", "usefulness", LegacyQuestionarioMapper.TrackQuestionId(_trackA.ToString("N")), "topics"],
            batch.Responses.Single().Answers.Select(a => a.QuestionId));
    }

    [Fact]
    public void PlannerCreatesOneBatchPerWorkshopAndSource()
    {
        var feedback = new[] { Feedback(1, _trackA, 4, null, 0, "Sessione A") };
        var sqlRows = new[]
        {
            Questionario(ResponseSource.LegacySqlServer, "1", 4, 4),
            Questionario(ResponseSource.LegacySqlServer, "2", 3, 3),
            Questionario(ResponseSource.LegacySqlite, "3", 8, 8),
        };

        var batches = QuestionnaireMigrationPlanner.Plan(feedback, sqlRows, new Dictionary<Guid, Workshop> { [_workshopId] = Workshop() }, _now);

        Assert.Equal([ResponseSource.LegacyFeedback, ResponseSource.LegacySqlServer, ResponseSource.LegacySqlite],
            batches.Select(b => b.Questionnaire.Origin));
        Assert.Equal([1, 2, 1], batches.Select(b => b.Responses.Count));
        Assert.Equal(3, batches.Select(b => b.Questionnaire.QuestionnaireId).Distinct().Count());
        Assert.All(batches, b => Assert.Equal(_workshopId, b.Questionnaire.WorkshopId));
    }

    [Fact]
    public void ReaderHandlesSqlServerAndSqliteSchemas()
    {
        var server = new DataTable();
        foreach (var (name, type) in new[] { ("QuestionarioTestId", typeof(Guid)), ("Data", typeof(DateTime)), ("Nome", typeof(string)),
            ("EMail", typeof(string)), ("ConsigliSuggerimenti", typeof(string)), ("ValutazioneQualitaGeneraleEvento", typeof(int)),
            ("WorkshopId", typeof(Guid)), ("Track01WorkshopTrackId", typeof(Guid)), ("Track01Valutazione", typeof(int)) })
        {
            server.Columns.Add(name, type);
        }

        var id = Guid.NewGuid();
        server.Rows.Add(id, _eventDay, "Mario", "m@example.com", "ok", 4, _workshopId, _trackA, 5);
        var sqlite = new DataTable();
        foreach (var name in new[] { "QuestionarioTestId", "Data", "WorkshopId", "Track02WorkshopTrackId", "Track02Valutazione" })
        {
            sqlite.Columns.Add(name, typeof(string));
        }

        sqlite.Rows.Add("abc", "2024-03-15", _workshopId.ToString(), _trackB.ToString(), "7");

        var serverRow = LegacyQuestionarioReader.Read(server.CreateDataReader(), ResponseSource.LegacySqlServer).Single();
        var sqliteRow = LegacyQuestionarioReader.Read(sqlite.CreateDataReader(), ResponseSource.LegacySqlite).Single();

        Assert.Equal(id.ToString(), serverRow.Id);
        Assert.Equal("ok", serverRow.Suggestions);
        Assert.Equal(4, serverRow.OverallRating);
        Assert.Equal(5, serverRow.Tracks.Single(t => t.Slot == 1).Rating);
        Assert.Equal(5, serverRow.Tracks.Count);
        Assert.Null(sqliteRow.Suggestions);
        Assert.Equal(new DateTime(2024, 3, 15), sqliteRow.Date.Date);
        Assert.Equal(7, sqliteRow.Tracks.Single(t => t.Slot == 2).Rating);
        Assert.Equal(_trackB.ToString(), sqliteRow.Tracks.Single(t => t.Slot == 2).WorkshopTrackId);
    }

    [Fact]
    public void OptionsDefaultToDryRunAndCommandLineOverridesConfiguration()
    {
        var dryRun = QuestionnaireMigrationOptions.Parse(["questionnaires"], "configured-sql", null);
        var apply = QuestionnaireMigrationOptions.Parse(["questionnaires", "--apply", "--no-feedback", "--sqlite", "Data Source=q.db"], "configured-sql", "x");

        Assert.True(QuestionnaireMigrationOptions.IsQuestionnaireCommand(["Questionnaires"]));
        Assert.False(QuestionnaireMigrationOptions.IsQuestionnaireCommand([]));
        Assert.False(dryRun.Apply);
        Assert.True(dryRun.IncludeFeedback);
        Assert.Equal("configured-sql", dryRun.SqlServerConnectionString);
        Assert.True(apply.Apply);
        Assert.False(apply.IncludeFeedback);
        Assert.Equal("Data Source=q.db", apply.SqliteConnectionString);
        Assert.Throws<ArgumentException>(() => QuestionnaireMigrationOptions.Parse(["questionnaires", "--bogus"]));
        Assert.Throws<ArgumentException>(() => QuestionnaireMigrationOptions.Parse(["questionnaires", "--sqlserver"]));
    }

    private static Workshop Workshop() => new()
    {
        WorkshopId = _workshopId,
        Title = "Workshop di prova",
        Tracks =
        [
            new WorkshopTrack { WorkshopTrackId = _trackA, Title = "Sessione A", SpeakersName = "Mario Rossi", StartTime = _eventDay },
            new WorkshopTrack { WorkshopTrackId = _trackB, Title = "Sessione B", StartTime = _eventDay.AddHours(1) },
        ],
    };

    private static Feedback Feedback(int id, Guid trackId, int rating, string? note, double seconds, string? trackTitle = null) => new()
    {
        FeedbackId = Guid.Parse($"cccccccc-0000-0000-0000-{id:000000000000}"),
        WorkshopId = _workshopId,
        WorkshopTrackId = trackId,
        Rating = rating,
        Note = note,
        WorkshopTitle = "Workshop di prova",
        TrackTitle = trackTitle,
        CreatedDate = _eventDay.AddSeconds(seconds),
    };

    private static LegacyQuestionarioRow Questionario(ResponseSource source, string id, int overall, int usefulness) => new()
    {
        Source = source,
        Id = id,
        Date = _eventDay,
        Name = " Mario ",
        Surname = "Rossi",
        Email = " Mario@Example.com ",
        OverallRating = overall,
        UsefulnessRating = usefulness,
        WorkshopId = _workshopId.ToString(),
        Topics = "AI",
    };

    private static LegacyTrackRating Track(int slot, object? trackId, int rating) => new()
    {
        Slot = slot,
        WorkshopTrackId = trackId?.ToString(),
        Rating = rating,
    };
}
