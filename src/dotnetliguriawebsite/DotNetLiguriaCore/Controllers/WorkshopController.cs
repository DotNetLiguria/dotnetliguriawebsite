using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver.Core.Operations;

namespace DotNetLiguriaCore.Controllers
{
    public class WorkshopController : ControllerBase
    {
        private readonly WorkshopService _workshopService;

        public WorkshopController(WorkshopService workshopService)
        {
            _workshopService = workshopService;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<List<Workshop>> Get() =>
            await _workshopService.GetAsync();

        [HttpGet("{id}")]
        public async Task<ActionResult<Workshop>> Get(Guid id)
        {
            var Workshop = await _workshopService.GetAsync(id);

            if (Workshop is null)
            {
                return NotFound();
            }

            return Workshop;
        }

        [HttpPost]
        public async Task<IActionResult> Post(Workshop newWorkshop)
        {
            await _workshopService.CreateAsync(newWorkshop);

            return CreatedAtAction(nameof(Get), new { id = newWorkshop.WorkshopId }, newWorkshop);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, Workshop updatedWorkshop)
        {
            var Workshop = await _workshopService.GetAsync(id);

            if (Workshop is null)
            {
                return NotFound();
            }

            updatedWorkshop.WorkshopId = Workshop.WorkshopId;

            await _workshopService.UpdateAsync(id, updatedWorkshop);

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var Workshop = await _workshopService.GetAsync(id);

            if (Workshop is null)
            {
                return NotFound();
            }

            await _workshopService.RemoveAsync(id);

            return NoContent();
        }
    }
}
