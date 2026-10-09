using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Xunit;
using static DotNetLiguriaCore.Tests.Questionnaires.QuestionnaireSamples;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class QuestionnaireServiceTests
{
    private static readonly DateTimeOffset _now = new(2025, 5, 1, 12, 0, 0, TimeSpan.Zero);
    private readonly InMemoryQuestionnaireStore _store = new();
    private readonly FixedTimeProvider _time = new(_now);
    private readonly QuestionnaireService _service;

    public QuestionnaireServiceTests()
    {
        _service = new QuestionnaireService(_store, _time);
    }

    [Fact]
    public async Task PublishValidatesTheDefinition()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest { Title = "Vuoto" }, null, "admin");

        var result = await _service.PublishAsync(created.QuestionnaireId);

        Assert.Equal(QuestionnaireOperationStatus.Invalid, result.Status);
        Assert.NotEmpty(result.Errors);
    }

    [Fact]
    public async Task SubmitStoresSanitizedResponseWithServerTime()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText, required: true));

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "  ciao ")] });

        Assert.Equal(QuestionnaireOperationStatus.Ok, result.Status);
        var stored = Assert.Single(_store.Responses);
        Assert.Equal("ciao", stored.Answers[0].Text);
        Assert.Equal(_now.UtcDateTime, stored.SubmittedAt);
        Assert.Equal(ResponseSource.Web, stored.Source);
    }

    [Fact]
    public async Task HoneypotSucceedsWithoutStoring()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText));

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Website = "http://spam" });

        Assert.Equal(QuestionnaireOperationStatus.Ok, result.Status);
        Assert.Empty(_store.Responses);
    }

    [Fact]
    public async Task ClosedWindowRejectsSubmissions()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText));
        var questionnaire = (await _service.GetAsync(id))!;
        questionnaire.ClosesAt = _now.UtcDateTime.AddHours(1);
        Assert.Equal(QuestionnaireOperationStatus.Ok, (await _service.UpdateAsync(id, questionnaire)).Status);
        _time.Now = _now.AddHours(2);

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "x")] });
        var view = await _service.GetPublicAsync(id);

        Assert.Equal(QuestionnaireOperationStatus.Unavailable, result.Status);
        Assert.Equal(QuestionnaireAvailability.Closed, view!.Availability);
        Assert.Null(view.Questionnaire);
    }

    [Fact]
    public async Task OnePerEmailRejectsSecondSubmissionCaseInsensitively()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), questionnaire =>
        {
            questionnaire.RespondentMode = RespondentMode.Identified;
            questionnaire.OnePerEmail = true;
        });
        SubmitQuestionnaireResponseRequest Request(string email) => new()
        {
            Respondent = new Respondent { Name = "Ada", Surname = "Lovelace", Email = email },
        };

        var first = await _service.SubmitAsync(id, Request("ada@example.org"));
        var second = await _service.SubmitAsync(id, Request("ADA@Example.org"));

        Assert.Equal(QuestionnaireOperationStatus.Ok, first.Status);
        Assert.Equal(QuestionnaireOperationStatus.Duplicate, second.Status);
        Assert.Single(_store.Responses);
    }

    [Fact]
    public async Task StructureIsLockedOnceResponsesExistButTextsRemainEditable()
    {
        var id = await CreatePublishedAsync(Choice("c", required: true));
        await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("c", choices: "a")] });

        var renamed = (await _service.GetAsync(id))!;
        renamed.Sections[0].Questions[0].Title = "Nuovo testo";
        renamed.Sections[0].Questions[0].Options[0].Label = "Opzione A";
        var renameResult = await _service.UpdateAsync(id, renamed);

        var restructured = renameResult.Value!;
        restructured.Sections[0].Questions[0].Options.RemoveAt(2);
        var restructureResult = await _service.UpdateAsync(id, restructured);

        Assert.Equal(QuestionnaireOperationStatus.Ok, renameResult.Status);
        Assert.Equal(1, renameResult.Value!.ResponseCount);
        Assert.Equal(QuestionnaireOperationStatus.Conflict, restructureResult.Status);
    }

    [Fact]
    public async Task StaleVersionIsRejected()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, null);
        var first = (await _service.GetAsync(created.QuestionnaireId))!;
        var second = (await _service.GetAsync(created.QuestionnaireId))!;
        first.Title = "A";
        second.Title = "B";

        Assert.Equal(QuestionnaireOperationStatus.Ok, (await _service.UpdateAsync(created.QuestionnaireId, first)).Status);
        Assert.Equal(QuestionnaireOperationStatus.Conflict, (await _service.UpdateAsync(created.QuestionnaireId, second)).Status);
    }

    [Fact]
    public async Task UpdateCannotChangeServerControlledFields()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, "owner");
        var tampered = (await _service.GetAsync(created.QuestionnaireId))!;
        tampered.Status = QuestionnaireStatus.Published;
        tampered.CreatedBy = "attacker";

        var result = await _service.UpdateAsync(created.QuestionnaireId, tampered);

        Assert.Equal(QuestionnaireStatus.Draft, result.Value!.Status);
        Assert.Equal("owner", result.Value.CreatedBy);
        Assert.Equal(2, result.Value.Version);
    }

    [Fact]
    public async Task QuestionnaireWithResponsesCannotBeDeletedButCanBeDuplicated()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText));
        await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "x")] });

        var delete = await _service.DeleteAsync(id);
        var copy = await _service.DuplicateAsync(id, "admin");

        Assert.Equal(QuestionnaireOperationStatus.Conflict, delete.Status);
        Assert.Equal(QuestionnaireStatus.Draft, copy.Value!.Status);
        Assert.NotEqual(id, copy.Value.QuestionnaireId);
        Assert.Equal(QuestionnaireOperationStatus.Ok, (await _service.DeleteAsync(copy.Value.QuestionnaireId)).Status);
    }

    [Fact]
    public async Task WorkshopLookupPrefersTheOpenQuestionnaire()
    {
        var workshopId = Guid.NewGuid();
        var closedId = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), q => q.WorkshopId = workshopId);
        await _service.CloseAsync(closedId);
        var openId = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), q => q.WorkshopId = workshopId);

        var view = await _service.GetPublicByWorkshopAsync(workshopId);

        Assert.Equal(openId, view!.QuestionnaireId);
        Assert.Equal(QuestionnaireAvailability.Open, view.Availability);
        Assert.Null(view.Questionnaire!.CreatedBy);
    }

    [Fact]
    public async Task DraftsAreNotPublic()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, null);

        Assert.Null(await _service.GetPublicAsync(created.QuestionnaireId));
        Assert.Equal(QuestionnaireOperationStatus.NotFound,
            (await _service.SubmitAsync(created.QuestionnaireId, new SubmitQuestionnaireResponseRequest())).Status);
    }

    private async Task<Guid> CreatePublishedAsync(Question question, Action<Questionnaire>? configure = null)
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest { Title = "Q" }, null, "admin");
        var questionnaire = (await _service.GetAsync(created.QuestionnaireId))!;
        questionnaire.Sections[0].Questions.Add(question);
        configure?.Invoke(questionnaire);
        var updated = await _service.UpdateAsync(created.QuestionnaireId, questionnaire);
        Assert.Equal(QuestionnaireOperationStatus.Ok, updated.Status);
        var published = await _service.PublishAsync(created.QuestionnaireId);
        Assert.Equal(QuestionnaireOperationStatus.Ok, published.Status);
        return created.QuestionnaireId;
    }
}
