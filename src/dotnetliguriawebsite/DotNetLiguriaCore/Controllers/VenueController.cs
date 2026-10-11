using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VenueController(VenueService venueService) : ControllerBase
    {
        private readonly VenueService _venueService = venueService;

        [HttpGet]
        public async Task<List<Venue>> Get() =>
            await _venueService.GetAsync();

        [HttpGet("{id}")]
        public async Task<ActionResult<Venue>> Get(Guid id)
        {
            var venue = await _venueService.GetAsync(id);
            return venue is null ? NotFound() : venue;
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPost]
        public async Task<IActionResult> Post(Venue newVenue)
        {
            newVenue.VenueId = Guid.NewGuid();
            await _venueService.CreateAsync(newVenue);
            return CreatedAtAction(nameof(Get), new { id = newVenue.VenueId }, newVenue);
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, Venue updatedVenue)
        {
            var venue = await _venueService.GetAsync(id);
            if (venue is null)
            {
                return NotFound();
            }

            updatedVenue.VenueId = venue.VenueId;
            await _venueService.UpdateAsync(id, updatedVenue);
            return NoContent();
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var venue = await _venueService.GetAsync(id);
            if (venue is null)
            {
                return NotFound();
            }

            await _venueService.RemoveAsync(id);
            return NoContent();
        }
    }
}
