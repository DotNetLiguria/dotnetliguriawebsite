using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography.X509Certificates;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class WorkshopController(WorkshopService workshopService, SpeakerService speakerService, WorkshopFileService workshopFileService, CounterService counterService, FeedbackService feedbackService, IWebHostEnvironment environment) : ControllerBase
    {
        private readonly WorkshopService _workshopService = workshopService;
        private readonly SpeakerService _speakerService = speakerService;
        private readonly WorkshopFileService _workshopFileService = workshopFileService;
        private readonly CounterService _counterService = counterService;
        private readonly FeedbackService _feedbackService = feedbackService;
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
            
            var counter = await _counterService.GetByNameAsync("Workshop");
            
            if (counter is null)
            {
                return BadRequest("Workshop counter not found.");
            }
            
            var newWorkshopNumber = counter.Value ?? 1;
            var folderName = $"workshop{newWorkshopNumber:000}";
            newWorkshop.FolderName = folderName;
            
            var contentsPath = Path.Combine(_environment.ContentRootPath, "Contents");
            var workshopPath = Path.Combine(contentsPath, "workshops", folderName);
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
            
            if (newWorkshop.In_homepage)
            {
                await _workshopService.ClearAllHomepageAsync();
            }
            
            await _workshopService.CreateAsync(newWorkshop);
            
            counter.Value = newWorkshopNumber + 1;
            await _counterService.UpdateAsync(counter.CounterId, counter);

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

        [HttpGet("{id}")]
        public async Task<ActionResult<WorkshopFeedbackModel>> GetFeedBack(Guid id)
        {
            var workshop = await _workshopService.GetAsync(id);

            if (workshop is null)
            {
                return NotFound();
            }

            if (!workshop.FeedbackEnabled)
            {
                return NotFound();
            }

            await AddSpeakers(workshop);

            var feedbackModel = new WorkshopFeedbackModel
            {
                Id = workshop.WorkshopId,
                Location = workshop.Location?.Name ?? "Location TBD",
                Date = workshop.EventDate?.ToString("dd/MM/yyyy") ?? "Date TBD",
                Summary = workshop.Description ?? string.Empty,
                Title = workshop.Title ?? string.Empty,
                Tracks = workshop.Tracks?.Select(track => new WorkshopTrackFeedbackModel
                {
                    WorkshopTrackId = track.WorkshopTrackId,
                    Title = track.Title ?? "Untitled Track",
                    Speakers = track.SpeakersName ?? "No speakers"
                }).ToList() ?? []
            };

            feedbackModel.Tracks.Add(new WorkshopTrackFeedbackModel()
            {
                Speakers = "Tutti",
                Title = "L'evento ha soddisfatto le tue aspettative?",
                WorkshopTrackId = Guid.NewGuid()
            });

            return feedbackModel;
        }

        [HttpGet("Summary/{id}")]
        public async Task<ActionResult<WorkshopFeedbackSummary>> GetWorkshopFeedbackSummary(Guid id)
        {
            var workshop = await _workshopService.GetAsync(id);
            
            if (workshop is null)
            {
                return NotFound("Workshop not found.");
            }

            var feedbacks = await _feedbackService.GetByWorkshopAsync(id);
            
            if (feedbacks == null || feedbacks.Count == 0)
            {
                return NotFound("No feedback found for this workshop.");
            }

            var summary = new WorkshopFeedbackSummary
            {
                WorkshopId = workshop.WorkshopId,
                Title = workshop.Title ?? "Untitled Workshop",
                Date = workshop.EventDate?.ToString("dd/MM/yyyy")
            };

            return Ok(summary);
        }

        [HttpGet("Summary")]
        public async Task<ActionResult<List<WorkshopFeedbackSummary>>> GetWorkshopsWithFeedback()
        {
            var allFeedbacks = await _feedbackService.GetAsync();

            if (allFeedbacks == null || allFeedbacks.Count == 0)
            {
                return Ok(new List<WorkshopFeedbackSummary>());
            }

            var workshopIds = allFeedbacks.Select(f => f.WorkshopId).Distinct().ToList();

            var summaryList = new List<WorkshopFeedbackSummary>();

            foreach (var workshopId in workshopIds)
            {
                var workshop = await _workshopService.GetAsync(workshopId);
                
                if (workshop != null)
                {
                    summaryList.Add(new WorkshopFeedbackSummary
                    {
                        WorkshopId = workshop.WorkshopId,
                        Title = workshop.Title ?? "Untitled Workshop",
                        Date = workshop.EventDate?.ToString("dd/MM/yyyy")
                    });
                }
            }

            return Ok(summaryList.OrderByDescending(w => w.Date).ToList());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<WorkshopFeedbackStatistics>> GetFeedbackStatistics(Guid id)
        {
            var workshop = await _workshopService.GetAsync(id);
            if (workshop is null)
            {
                return NotFound("Workshop not found.");
            }

            var feedbacks = await _feedbackService.GetByWorkshopAsync(id);

            if (feedbacks == null || feedbacks.Count == 0)
            {
                return NotFound("No feedback found for this workshop.");
            }

            var statistics = FeedbackStatisticsCalculator.Calculate(
                workshop.WorkshopId, workshop.Title ?? "Untitled Workshop", feedbacks);

            return Ok(statistics);
        }

        [HttpGet]
        public async Task<ActionResult<List<WorkshopFeedbackStatistics>>> GetFeedbackStatistics()
        {
            var allFeedbacks = await _feedbackService.GetAsync();

            if (allFeedbacks == null || allFeedbacks.Count == 0)
            {
                return Ok(new List<WorkshopFeedbackStatistics>());
            }

            var workshopStatisticsList = allFeedbacks
                .GroupBy(f => f.WorkshopId)
                .Select(workshopGroup =>
                {
                    var workshopFeedbacks = workshopGroup.ToList();
                    var workshopTitle = workshopFeedbacks.FirstOrDefault()?.WorkshopTitle ?? "Unknown Workshop";

                    return FeedbackStatisticsCalculator.Calculate(workshopGroup.Key, workshopTitle, workshopFeedbacks);
                })
                .ToList();

            return Ok(workshopStatisticsList);
        }

        [HttpPost]
        public async Task<IActionResult> SubmitFeedback(SubmitFeedbackRequest feedbackRequest)
        {
            if (feedbackRequest.WorkshopId == Guid.Empty)
            {
                return BadRequest("Workshop ID is required.");
            }

            if (feedbackRequest.TrackFeedbacks == null || feedbackRequest.TrackFeedbacks.Count == 0)
            {
                return BadRequest("At least one track feedback is required.");
            }

            var workshop = await _workshopService.GetAsync(feedbackRequest.WorkshopId);
            if (workshop is null)
            {
                return NotFound("Workshop not found.");
            }

            if (!workshop.FeedbackEnabled)
            {
                return NotFound();
            }

            var savedFeedbacks = new List<object>();

            foreach (var trackFeedback in feedbackRequest.TrackFeedbacks)
            {
                if (trackFeedback.WorkshopTrackId == Guid.Empty)
                {
                    return BadRequest("Workshop Track ID is required for all feedbacks.");
                }

                if (trackFeedback.Rating < 0 || trackFeedback.Rating > 10)
                {
                    return BadRequest("Rating must be between 0 and 10 for all feedbacks.");
                }

                var track = workshop.Tracks?.FirstOrDefault(t => t.WorkshopTrackId == trackFeedback.WorkshopTrackId);

                var feedback = new Feedback
                {
                    FeedbackId = Guid.NewGuid(),
                    WorkshopId = feedbackRequest.WorkshopId,
                    WorkshopTrackId = trackFeedback.WorkshopTrackId,
                    Rating = trackFeedback.Rating,
                    Note = feedbackRequest.Note,
                    WorkshopTitle = workshop.Title,
                    TrackTitle = track?.Title,
                    CreatedDate = DateTime.Now
                };

                await _feedbackService.CreateAsync(feedback);

                savedFeedbacks.Add(new 
                { 
                    feedbackId = feedback.FeedbackId,
                    workshopTrackId = feedback.WorkshopTrackId,
                    rating = feedback.Rating,
                    workshopTitle = feedback.WorkshopTitle,
                    trackTitle = feedback.TrackTitle
                });
            }

            return Ok(new 
            { 
                message = "Feedback saved successfully",
                workshopId = feedbackRequest.WorkshopId,
                feedbackCount = savedFeedbacks.Count,
                feedbacks = savedFeedbacks,
                note = feedbackRequest.Note
            });
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
    }
}