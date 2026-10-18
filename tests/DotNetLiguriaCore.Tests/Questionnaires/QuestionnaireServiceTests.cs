using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using DotNetLiguriaCore.Security;
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
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest { Title = "Vuoto" }, null, "admin",
            TestContext.Current.CancellationToken);

        var result = await _service.PublishAsync(created.QuestionnaireId, TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Invalid, result.Status);
        Assert.NotEmpty(result.Errors);
    }

    [Fact]
    public async Task SubmitStoresSanitizedResponseWithServerTime()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText, required: true),
            cancellationToken: TestContext.Current.CancellationToken);

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "  ciao ")] },
            TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Ok, result.Status);
        var stored = Assert.Single(_store.Responses);
        Assert.Equal("ciao", stored.Answers[0].Text);
        Assert.Equal(_now.UtcDateTime, stored.SubmittedAt);
        Assert.Equal(ResponseSource.Web, stored.Source);
    }

    [Fact]
    public async Task HoneypotSucceedsWithoutStoring()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText),
            cancellationToken: TestContext.Current.CancellationToken);

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Website = "http://spam" },
            TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Ok, result.Status);
        Assert.Empty(_store.Responses);
    }

    [Fact]
    public async Task ClosedWindowRejectsSubmissions()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText),
            cancellationToken: TestContext.Current.CancellationToken);
        var questionnaire = (await _service.GetAsync(id, TestContext.Current.CancellationToken))!;
        questionnaire.ClosesAt = _now.UtcDateTime.AddHours(1);
        Assert.Equal(QuestionnaireOperationStatus.Ok,
            (await _service.UpdateAsync(id, questionnaire, TestContext.Current.CancellationToken)).Status);
        _time.Now = _now.AddHours(2);

        var result = await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "x")] },
            TestContext.Current.CancellationToken);
        var view = await _service.GetPublicAsync(id, TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Unavailable, result.Status);
        Assert.Equal(QuestionnaireAvailability.Closed, view!.Availability);
        Assert.Null(view.Questionnaire);
    }

    [Fact]
    public async Task OnePerAccountStoresOnlyVerifiedOpaqueIdentityAndRejectsDuplicates()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), questionnaire =>
            {
                questionnaire.RespondentMode = RespondentMode.Authenticated;
                questionnaire.OnePerAccount = true;
            },
            TestContext.Current.CancellationToken);
        var account = new AccountIdentity("https://identity.example.test/realms/test", "synthetic-subject");
        var anonymous = await _service.SubmitAsync(id, new(), TestContext.Current.CancellationToken);
        var first = await _service.SubmitAsync(id, new(), TestContext.Current.CancellationToken, account);
        var second = await _service.SubmitAsync(id, new(), TestContext.Current.CancellationToken, account);

        Assert.Equal(QuestionnaireOperationStatus.Unauthorized, anonymous.Status);
        Assert.Equal(QuestionnaireOperationStatus.Ok, first.Status);
        Assert.Equal(QuestionnaireOperationStatus.Duplicate, second.Status);
        var response = Assert.Single(_store.Responses);
        Assert.Null(response.Respondent);
        Assert.Null(response.UniqueEmailKey);
        Assert.Equal(account.Subject, response.AccountSubject);
        Assert.Equal(account.Issuer, response.AccountIssuer);
        Assert.NotNull(response.UniqueAccountKey);
    }

    [Fact]
    public async Task StructureIsLockedOnceResponsesExistButTextsRemainEditable()
    {
        var id = await CreatePublishedAsync(Choice("c", required: true),
            cancellationToken: TestContext.Current.CancellationToken);
        await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("c", choices: "a")] },
            TestContext.Current.CancellationToken);

        var renamed = (await _service.GetAsync(id, TestContext.Current.CancellationToken))!;
        renamed.Sections[0].Questions[0].Title = "Nuovo testo";
        renamed.Sections[0].Questions[0].Options[0].Label = "Opzione A";
        var renameResult = await _service.UpdateAsync(id, renamed, TestContext.Current.CancellationToken);

        var restructured = renameResult.Value!;
        restructured.Sections[0].Questions[0].Options.RemoveAt(2);
        var restructureResult = await _service.UpdateAsync(id, restructured, TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Ok, renameResult.Status);
        Assert.Equal(1, renameResult.Value!.ResponseCount);
        Assert.Equal(QuestionnaireOperationStatus.Conflict, restructureResult.Status);
    }

    [Fact]
    public async Task StaleVersionIsRejected()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, null, TestContext.Current.CancellationToken);
        var first = (await _service.GetAsync(created.QuestionnaireId, TestContext.Current.CancellationToken))!;
        var second = (await _service.GetAsync(created.QuestionnaireId, TestContext.Current.CancellationToken))!;
        first.Title = "A";
        second.Title = "B";

        Assert.Equal(QuestionnaireOperationStatus.Ok,
            (await _service.UpdateAsync(created.QuestionnaireId, first, TestContext.Current.CancellationToken)).Status);
        Assert.Equal(QuestionnaireOperationStatus.Conflict,
            (await _service.UpdateAsync(created.QuestionnaireId, second, TestContext.Current.CancellationToken)).Status);
    }

    [Fact]
    public async Task UpdateCannotChangeServerControlledFields()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, "owner", TestContext.Current.CancellationToken);
        var tampered = (await _service.GetAsync(created.QuestionnaireId, TestContext.Current.CancellationToken))!;
        tampered.Status = QuestionnaireStatus.Published;
        tampered.CreatedBy = "attacker";

        var result = await _service.UpdateAsync(created.QuestionnaireId, tampered, TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireStatus.Draft, result.Value!.Status);
        Assert.Equal("owner", result.Value.CreatedBy);
        Assert.Equal(2, result.Value.Version);
    }

    [Fact]
    public async Task QuestionnaireWithResponsesCannotBeDeletedButCanBeDuplicated()
    {
        var id = await CreatePublishedAsync(Simple("q", QuestionType.ShortText),
            cancellationToken: TestContext.Current.CancellationToken);
        await _service.SubmitAsync(id, new SubmitQuestionnaireResponseRequest { Answers = [Answer("q", text: "x")] },
            TestContext.Current.CancellationToken);

        var delete = await _service.DeleteAsync(id, TestContext.Current.CancellationToken);
        var copy = await _service.DuplicateAsync(id, "admin", TestContext.Current.CancellationToken);

        Assert.Equal(QuestionnaireOperationStatus.Conflict, delete.Status);
        Assert.Equal(QuestionnaireStatus.Draft, copy.Value!.Status);
        Assert.NotEqual(id, copy.Value.QuestionnaireId);
        Assert.Equal(QuestionnaireOperationStatus.Ok,
            (await _service.DeleteAsync(copy.Value.QuestionnaireId, TestContext.Current.CancellationToken)).Status);
    }

    [Fact]
    public async Task WorkshopLookupPrefersTheOpenQuestionnaire()
    {
        var workshopId = Guid.NewGuid();
        var closedId = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), q => q.WorkshopId = workshopId,
            TestContext.Current.CancellationToken);
        await _service.CloseAsync(closedId, TestContext.Current.CancellationToken);
        var openId = await CreatePublishedAsync(Simple("q", QuestionType.ShortText), q => q.WorkshopId = workshopId,
            TestContext.Current.CancellationToken);

        var view = await _service.GetPublicByWorkshopAsync(workshopId, TestContext.Current.CancellationToken);

        Assert.Equal(openId, view!.QuestionnaireId);
        Assert.Equal(QuestionnaireAvailability.Open, view.Availability);
        Assert.Null(view.Questionnaire!.CreatedBy);
    }

    [Fact]
    public async Task DraftsAreNotPublic()
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest(), null, null, TestContext.Current.CancellationToken);

        Assert.Null(await _service.GetPublicAsync(created.QuestionnaireId, TestContext.Current.CancellationToken));
        Assert.Equal(QuestionnaireOperationStatus.NotFound,
            (await _service.SubmitAsync(created.QuestionnaireId, new SubmitQuestionnaireResponseRequest(),
                TestContext.Current.CancellationToken)).Status);
    }

    private async Task<Guid> CreatePublishedAsync(Question question, Action<Questionnaire>? configure = null,
        CancellationToken cancellationToken = default)
    {
        var created = await _service.CreateAsync(new CreateQuestionnaireRequest { Title = "Q" }, null, "admin", cancellationToken);
        var questionnaire = (await _service.GetAsync(created.QuestionnaireId, cancellationToken))!;
        questionnaire.Sections[0].Questions.Add(question);
        configure?.Invoke(questionnaire);
        var updated = await _service.UpdateAsync(created.QuestionnaireId, questionnaire, cancellationToken);
        Assert.Equal(QuestionnaireOperationStatus.Ok, updated.Status);
        var published = await _service.PublishAsync(created.QuestionnaireId, cancellationToken);
        Assert.Equal(QuestionnaireOperationStatus.Ok, published.Status);
        return created.QuestionnaireId;
    }
}
