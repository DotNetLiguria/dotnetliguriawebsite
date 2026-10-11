using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class SpeakerController : ControllerBase
    {
        private readonly SpeakerService _speakerService;
        private readonly IAuthorizationService _authorizationService;

        public SpeakerController(SpeakerService speakerService, IAuthorizationService authorizationService)
        {
            _speakerService = speakerService;
            _authorizationService = authorizationService;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] bool onlyActive = false)
        {
            if (await HttpContext.IsWebDevAdminAsync(_authorizationService))
            {
                return Ok(await _speakerService.GetAsync(onlyActive));
            }

            var publicSpeakers = (await _speakerService.GetAsync(onlyActive: true))
                .Select(speaker => new
                {
                    speaker.WorkshopSpeakerId,
                    speaker.Name,
                    speaker.ProfileImageUrl,
                    speaker.IsActive,
                    speaker.Description
                });

            return Ok(publicSpeakers);
        }

        [AllowAnonymous]
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            var isAdmin = await HttpContext.IsWebDevAdminAsync(_authorizationService);
            var speaker = await _speakerService.GetAsync(id);

            if (speaker is null || (!isAdmin && !speaker.IsActive))
            {
                return NotFound();
            }

            if (isAdmin)
            {
                return Ok(speaker);
            }

            return Ok(new
            {
                speaker.WorkshopSpeakerId,
                speaker.Name,
                speaker.ProfileImageUrl,
                speaker.IsActive,
                speaker.Description
            });
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPost]
        public async Task<IActionResult> Post(WorkshopSpeaker newWorkshopSpeaker)
        {
            await _speakerService.CreateAsync(newWorkshopSpeaker);

            return CreatedAtAction(nameof(Get), new { id = newWorkshopSpeaker.WorkshopSpeakerId }, newWorkshopSpeaker);
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, WorkshopSpeaker updatedWorkshopSpeacker)
        {
            var speacker = await _speakerService.GetAsync(id);

            if (speacker is null)
            {
                return NotFound();
            }

            updatedWorkshopSpeacker.WorkshopSpeakerId = speacker.WorkshopSpeakerId;

            await _speakerService.UpdateAsync(id, updatedWorkshopSpeacker);

            return NoContent();
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var speacker = await _speakerService.GetAsync(id);

            if (speacker is null)
            {
                return NotFound();
            }

            await _speakerService.RemoveAsync(id);

            return NoContent();
        }

    }
}
