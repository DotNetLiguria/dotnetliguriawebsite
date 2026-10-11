using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
	[Route("api/[controller]/[action]")]
	[ApiController]
	public class CounterController : ControllerBase
	{
		private readonly CounterService _counterService;

        public CounterController(CounterService counterService) => _counterService = counterService;

        [HttpGet]
		public async Task<List<Counter>> Get() =>
			await _counterService.GetAsync();

		[HttpGet("{id}")]
		public async Task<ActionResult<Counter>> Get(Guid id)
		{
			var counter = await _counterService.GetAsync(id);

			if (counter is null)
			{
				return NotFound();
			}

			return counter;
		}

		[HttpGet("{name}")]
		public async Task<ActionResult<CounterGetModel>> GetByName(string name)
		{
			var counter = await _counterService.GetByNameAsync(name);

			if (counter is null)
			{
				return NotFound();
			}

			var counterGetModel = new CounterGetModel
			{
				CounterId = counter.CounterId,
				Name = counter.Name,
				Value = counter.Value ?? 0
			};

			return counterGetModel;
		}

		[Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
		[HttpPost]
		public async Task<IActionResult> Post(Counter newCounter)
		{
			await _counterService.CreateAsync(newCounter);

			return CreatedAtAction(nameof(Get), new { id = newCounter.CounterId }, newCounter);
		}

		[Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
		[HttpPut("{id}")]
		public async Task<IActionResult> Update(Guid id, Counter updatedCounter)
		{
			var counter = await _counterService.GetAsync(id);

			if (counter is null)
			{
				return NotFound();
			}

			await _counterService.UpdateAsync(id, updatedCounter);

			return NoContent();
		}
		

	}
}