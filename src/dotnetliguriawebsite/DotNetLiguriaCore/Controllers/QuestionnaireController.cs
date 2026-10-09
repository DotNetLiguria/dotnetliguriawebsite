using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = QuestionnaireAuthorizationOptions.PolicyName)]
public class QuestionnaireController(
    QuestionnaireService questionnaireService,
    WorkshopService workshopService,
    SpeakerService speakerService) : ControllerBase
{
    private static readonly byte[] _utf8Bom = [0xEF, 0xBB, 0xBF];

    [HttpGet]
    public async Task<List<QuestionnaireSummary>> List(CancellationToken cancellationToken)
    {
        var summaries = await questionnaireService.ListAsync(cancellationToken);
        if (summaries.Any(s => s.WorkshopId.HasValue))
        {
            var titles = (await workshopService.GetAllAsync())
                .GroupBy(w => w.WorkshopId)
                .ToDictionary(g => g.Key, g => g.First().Title);
            foreach (var summary in summaries.Where(s => s.WorkshopId.HasValue))
            {
                summary.WorkshopTitle = titles.GetValueOrDefault(summary.WorkshopId!.Value);
            }
        }

        return summaries;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Questionnaire>> Get(Guid id, CancellationToken cancellationToken) =>
        await questionnaireService.GetAsync(id, cancellationToken) is { } questionnaire ? questionnaire : NotFound();

    [HttpGet("by-workshop/{workshopId:guid}")]
    public Task<List<Questionnaire>> GetByWorkshop(Guid workshopId, CancellationToken cancellationToken) =>
        questionnaireService.GetByWorkshopAsync(workshopId, cancellationToken);

    [HttpPost]
    public async Task<IActionResult> Create(CreateQuestionnaireRequest request, CancellationToken cancellationToken)
    {
        Workshop? workshop = null;
        if (request.WorkshopId is { } workshopId)
        {
            workshop = await workshopService.GetAsync(workshopId);
            if (workshop is null)
            {
                return NotFound(new QuestionnaireProblem { Code = "NotFound", Message = "Evento non trovato." });
            }

            await AddSpeakerNames(workshop);
        }

        var questionnaire = await questionnaireService.CreateAsync(request, workshop, CurrentUser(), cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = questionnaire.QuestionnaireId }, questionnaire);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, Questionnaire questionnaire, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.UpdateAsync(id, questionnaire, cancellationToken), Ok);

    [HttpPost("{id:guid}/duplicate")]
    public async Task<IActionResult> Duplicate(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.DuplicateAsync(id, CurrentUser(), cancellationToken), Ok);

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.PublishAsync(id, cancellationToken), Ok);

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.CloseAsync(id, cancellationToken), Ok);

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.ReopenAsync(id, cancellationToken), Ok);

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.ArchiveAsync(id, cancellationToken), Ok);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.DeleteAsync(id, cancellationToken), _ => NoContent());

    [HttpGet("{id:guid}/statistics")]
    public async Task<ActionResult<QuestionnaireStatistics>> Statistics(Guid id, CancellationToken cancellationToken) =>
        await questionnaireService.GetStatisticsAsync(id, cancellationToken) is { } statistics ? statistics : NotFound();

    [HttpGet("{id:guid}/responses")]
    public async Task<ActionResult<List<QuestionnaireResponse>>> Responses(Guid id, CancellationToken cancellationToken) =>
        await questionnaireService.GetResponsesAsync(id, cancellationToken) is { } responses ? responses : NotFound();

    [HttpDelete("{id:guid}/responses/{responseId:guid}")]
    public async Task<IActionResult> DeleteResponse(Guid id, Guid responseId, CancellationToken cancellationToken) =>
        await questionnaireService.DeleteResponseAsync(id, responseId, cancellationToken) ? NoContent() : NotFound();

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Export(Guid id, CancellationToken cancellationToken)
    {
        if (await questionnaireService.ExportCsvAsync(id, cancellationToken) is not { } export)
        {
            return NotFound();
        }

        var bytes = _utf8Bom.Concat(System.Text.Encoding.UTF8.GetBytes(export.Csv)).ToArray();
        return File(bytes, "text/csv; charset=utf-8", $"questionario-{export.Questionnaire.QuestionnaireId:N}.csv");
    }

    private string? CurrentUser() =>
        User.FindFirst("preferred_username")?.Value ?? User.FindFirst("email")?.Value ?? User.Identity?.Name;

    private async Task AddSpeakerNames(Workshop workshop)
    {
        if (workshop.Tracks is not { Count: > 0 })
        {
            return;
        }

        var speakers = await speakerService.GetAsync();
        foreach (var track in workshop.Tracks.Where(t => t.Speakers is { Count: > 0 } && string.IsNullOrWhiteSpace(t.SpeakersName)))
        {
            track.SpeakersName = string.Join(", ", speakers
                .Where(s => track.Speakers!.Contains(s.WorkshopSpeakerId) && s.Name != null)
                .Select(s => s.Name));
        }
    }
}
