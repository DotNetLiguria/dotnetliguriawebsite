using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography.X509Certificates;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class WorkshopController(WorkshopService workshopService, SpeakerService speakerService, WorkshopFileService workshopFileService, CounterService counterService, SessionizeImportService sessionizeImportService, IWebHostEnvironment environment) : ControllerBase
    {
        private readonly WorkshopService _workshopService = workshopService;
        private readonly SpeakerService _speakerService = speakerService;
        private readonly WorkshopFileService _workshopFileService = workshopFileService;
        private readonly CounterService _counterService = counterService;
        private readonly SessionizeImportService _sessionizeImportService = sessionizeImportService;
        private readonly IWebHostEnvironment _environment = environment;

        [HttpGet]
        public async Task<List<Workshop>> Get([FromQuery] bool onlyPublished = false)
        {
            var returnValue = await _workshopService.GetAsync(onlyPublished);
            foreach (var workshop in returnValue)
            {
                await AddSpeakers(workshop);
                await AddFiles(workshop);
            }
            return returnValue;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Workshop>> Get(Guid id)
        {
            var workshop = await _workshopService.GetAsync(id);

            if (workshop is null)
            {
                return NotFound();
            }

            await AddSpeakers(workshop);
            await AddFiles(workshop);

            return workshop;
        }

        [HttpGet("HomePage")]
        public async Task<ActionResult<Workshop>> GetInHomePage()
        {
            var workshop = await _workshopService.GetInHomePageAsync();

            if (workshop is null)
            {
                return NotFound();
            }

            await AddSpeakers(workshop);
            await AddFiles(workshop);

            return workshop;
        }

        [HttpGet("{year}")]
        public async Task<List<Workshop>> GetByYear(int year) =>
            await _workshopService.GetByYearAsync(year);

        [HttpPost]
        public async Task<IActionResult> Post(Workshop newWorkshop)
        {
            newWorkshop.WorkshopId = Guid.NewGuid();
            
            var counter = await _counterService.GetOrCreateWorkshopCounterAsync();
            var newWorkshopNumber = await _counterService.ReserveNextWorkshopNumberAsync(counter.CounterId);
            var folderName = $"workshop{newWorkshopNumber:000}";
            var contentsPath = Path.Combine(_environment.ContentRootPath, "Contents");
            var workshopPath = Path.Combine(contentsPath, "workshops", folderName);
            while (Directory.Exists(workshopPath))
            {
                newWorkshopNumber = await _counterService.ReserveNextWorkshopNumberAsync(counter.CounterId);
                folderName = $"workshop{newWorkshopNumber:000}";
                workshopPath = Path.Combine(contentsPath, "workshops", folderName);
            }
            newWorkshop.FolderName = folderName;

            Directory.CreateDirectory(workshopPath);
            Directory.CreateDirectory(Path.Combine(workshopPath, "photos"));
            Directory.CreateDirectory(Path.Combine(workshopPath, "tracks"));

            newWorkshop.Image = $"/workshops/{folderName}/workshop.png";
            newWorkshop.ImageThumbnail = $"/workshops/{folderName}/workshop_thumb.png";
            newWorkshop.CreationDate = DateTime.Now;
            newWorkshop.Published = false;
            
            if (newWorkshop.Tracks != null)
            {
                foreach (var track in newWorkshop.Tracks)
                {
                    if (track.WorkshopTrackId == Guid.Empty)
                    {
                        track.WorkshopTrackId = Guid.NewGuid();
                    }
                }
            }
            EnsureAgendaIds(newWorkshop);
            
            if (newWorkshop.In_homepage)
            {
                await _workshopService.ClearAllHomepageAsync();
            }
            
            await _workshopService.CreateAsync(newWorkshop);
            
            return CreatedAtAction(nameof(Get), new { id = newWorkshop.WorkshopId }, newWorkshop);
        }

        [HttpPost("{id}")]
        public async Task<IActionResult> ImportSessionize(Guid id, SessionizeImportRequest request, CancellationToken cancellationToken)
        {
            var workshop = await _workshopService.GetAsync(id);
            if (workshop is null)
            {
                return NotFound();
            }

            SessionizeImportData import;
            try
            {
                import = await _sessionizeImportService.ImportAsync(request.Url, cancellationToken);
            }
            catch (ArgumentException exception)
            {
                return BadRequest(new ProblemDetails
                {
                    Title = "Invalid Sessionize URL",
                    Detail = exception.Message,
                    Status = StatusCodes.Status400BadRequest
                });
            }
            catch (HttpRequestException)
            {
                return Problem(
                    detail: "Sessionize could not be reached or returned an unsuccessful response.",
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Sessionize import failed");
            }
            catch (System.Text.Json.JsonException)
            {
                return Problem(
                    detail: "Sessionize returned data that could not be read.",
                    statusCode: StatusCodes.Status502BadGateway,
                    title: "Sessionize import failed");
            }

            var importedSpeakers = await _speakerService.UpsertSessionizeAsync(import.Speakers);
            var speakersBySessionizeId = new Dictionary<string, WorkshopSpeaker>(StringComparer.Ordinal);
            foreach (var importedSpeaker in importedSpeakers)
            {
                if (importedSpeaker.SessionizeId is { } sessionizeId)
                {
                    speakersBySessionizeId[sessionizeId] = importedSpeaker;
                }
            }
            foreach (var speaker in import.Talks.SelectMany(talk => talk.Speakers))
            {
                if (speaker.SessionizeId is not null && speakersBySessionizeId.TryGetValue(speaker.SessionizeId, out var savedSpeaker))
                {
                    speaker.WorkshopSpeakerId = savedSpeaker.WorkshopSpeakerId;
                }
            }

            workshop.Talks = WorkshopTalkImportMerger.Merge(workshop.Talks ?? [], import.Talks);

            await _workshopService.UpdateAsync(id, workshop);
            return Ok(new { importedTalks = import.Talks.Count, importedSpeakers = importedSpeakers.Count });
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
            EnsureAgendaIds(updatedWorkshop);
            
            if (updatedWorkshop.Tracks != null)
            {
                foreach (var track in updatedWorkshop.Tracks)
                {
                    if (track.WorkshopTrackId == Guid.Empty)
                    {
                        track.WorkshopTrackId = Guid.NewGuid();
                    }
                }
            }

            if (updatedWorkshop.In_homepage)
            {
                await _workshopService.ClearAllHomepageAsync();
            }

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

        private async Task AddFiles(Workshop workshop)
        {
            var workshopFiles = await _workshopFileService.GetAsync(workshop.WorkshopId);

            foreach (var file in workshopFiles)
            {
                if (file.FileType == WorkshopFileTypeEnum.Photo)
                {
                    workshop.Photos ??= [];
                    workshop.Photos.Add(file);
                }

                if (file.FileType == WorkshopFileTypeEnum.Material)
                {
                    workshop.Materials ??= [];
                    workshop.Materials.Add(file);
                }
            }
        }

        private async Task AddSpeakers(Workshop workshop)
        {
            var speakers = await _speakerService.GetAsync();
            foreach (var track in workshop.Tracks ?? [])
            {
                if (track.Speakers != null && track.Speakers.Count > 0)
                {
                    var speakerDetails = speakers.Where(s => track.Speakers.Contains(s.WorkshopSpeakerId)).Select(s => s.Name).Where(name => name != null).Cast<string>().ToList();
                    track.SpeakersDetails = speakerDetails;
                    track.SpeakersName = string.Join(", ", speakerDetails);
                }
            }
        }

        private static void EnsureAgendaIds(Workshop workshop)
        {
            workshop.Talks ??= [];
            foreach (var talk in workshop.Talks)
            {
                if (talk.WorkshopTalkId == Guid.Empty)
                {
                    talk.WorkshopTalkId = Guid.NewGuid();
                }
                talk.Speakers ??= [];
                foreach (var speaker in talk.Speakers)
                {
                    if (speaker.WorkshopSpeakerId is not Guid speakerId || speakerId == Guid.Empty)
                    {
                        speaker.WorkshopSpeakerId = Guid.NewGuid();
                    }
                }
            }

            workshop.AgendaTracks ??= [];
            foreach (var track in workshop.AgendaTracks)
            {
                if (track.WorkshopAgendaTrackId == Guid.Empty)
                {
                    track.WorkshopAgendaTrackId = Guid.NewGuid();
                }
            }

            workshop.AgendaItems ??= [];
            foreach (var item in workshop.AgendaItems)
            {
                if (item.WorkshopAgendaItemId == Guid.Empty)
                {
                    item.WorkshopAgendaItemId = Guid.NewGuid();
                }
            }
        }
    }
}