using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class SpeakerController : ControllerBase
    {
        private readonly SpeakerService _speakerService;

        public SpeakerController(SpeakerService speakerService)
        {
            _speakerService = speakerService;
        }

        [HttpGet]
        public async Task<List<WorkshopSpeaker>> Get() =>
            await _speakerService.GetAsync();

        [HttpGet("{id}")]
        public async Task<ActionResult<WorkshopSpeaker>> Get(Guid id)
        {
            var speacker = await _speakerService.GetAsync(id);

            if (speacker is null)
            {
                return NotFound();
            }

            return speacker;
        }

        [HttpPost]
        public async Task<IActionResult> Post(WorkshopSpeaker newWorkshopSpeaker)
        {
            await _speakerService.CreateAsync(newWorkshopSpeaker);

            return CreatedAtAction(nameof(Get), new { id = newWorkshopSpeaker.WorkshopSpeakerId }, newWorkshopSpeaker);
        }

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
