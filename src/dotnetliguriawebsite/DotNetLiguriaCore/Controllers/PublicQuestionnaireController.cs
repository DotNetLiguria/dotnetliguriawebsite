using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace DotNetLiguriaCore.Controllers;

[Route("api/[controller]")]
[ApiController]
[AllowAnonymous]
[EnableRateLimiting(PublicQuestionnaireRateLimit.PolicyName)]
public class PublicQuestionnaireController(QuestionnaireService questionnaireService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PublicQuestionnaireView>> Get(Guid id, CancellationToken cancellationToken) =>
        await questionnaireService.GetPublicAsync(id, cancellationToken) is { } view ? view : NotFound();

    [HttpGet("by-workshop/{workshopId:guid}")]
    public async Task<ActionResult<PublicQuestionnaireView>> GetByWorkshop(Guid workshopId, CancellationToken cancellationToken) =>
        await questionnaireService.GetPublicByWorkshopAsync(workshopId, cancellationToken) is { } view ? view : NotFound();

    [HttpPost("{id:guid}/responses")]
    public async Task<IActionResult> Submit(Guid id, SubmitQuestionnaireResponseRequest request, CancellationToken cancellationToken) =>
        QuestionnaireActionResults.From(await questionnaireService.SubmitAsync(id, request, cancellationToken),
            responseId => Ok(new { responseId }));
}
