using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace DotNetLiguriaCore.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkshopFileController(WorkshopService workshopService, WorkshopFileService workshopFileService, IWebHostEnvironment environment, IAuthorizationService authorizationService) : ControllerBase
    {
        private readonly WorkshopService _workshopService = workshopService;
        private readonly WorkshopFileService _workshopFileService = workshopFileService;
        private readonly IWebHostEnvironment _environment = environment;
        private readonly IAuthorizationService _authorizationService = authorizationService;

        [AllowAnonymous]
        [HttpGet("{workshopId}")]
        public async Task<ActionResult<List<WorkshopFile>>> Get(Guid workshopId)
        {
            if (workshopId == Guid.Empty)
            {
                return BadRequest("Workshop ID is required.");
            }

            var workshop = await _workshopService.GetAsync(workshopId);
            if (workshop is null)
            {
                return NotFound();
            }

            var isAdmin = await HttpContext.IsWebDevAdminAsync(_authorizationService);
            if (!isAdmin && workshop.Published != true)
            {
                return NotFound();
            }

            var files = await _workshopFileService.GetAsync(workshopId);
            return Ok(files);
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPost("UploadWorkshopImage")]
        public async Task<IActionResult> UploadWorkshopImage(IFormFile file, [FromForm] Guid workshopId)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded.");
            }
            
            if (workshopId == Guid.Empty)
            {
                return BadRequest("Workshop ID is required.");
            }

            var workshop = await _workshopService.GetAsync(workshopId);
            
            if (workshop is null)
            {
                return NotFound("Workshop not found.");
            }
            
            if (string.IsNullOrEmpty(workshop.FolderName))
            {
                return BadRequest("Workshop folder name is not set.");
            }

            if (!WorkshopUploadValidation.TryGetSafeExtension(file.FileName, WorkshopFileTypeEnum.Image, out var extension))
            {
                return BadRequest("Only JPEG, PNG, WebP, and GIF images are allowed.");
            }

            var contentsPath = Path.Combine(_environment.ContentRootPath, "Contents");
            var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
            var workshopPath = Path.GetFullPath(Path.Combine(workshopsPath, workshop.FolderName));
            if (!IsPathWithinDirectory(workshopsPath, workshopPath))
            {
                return BadRequest("Workshop folder name is invalid.");
            }

            if (!Directory.Exists(workshopPath))
            {
                Directory.CreateDirectory(workshopPath);
            }

            var fileName = $"workshop{extension}";
            var filePath = Path.Combine(workshopPath, fileName);
            
            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/workshops/{workshop.FolderName}/{fileName}";
            
            await _workshopService.UpdateImageAsync(workshopId, relativePath);
            
            return Ok(new 
            { 
                fileName, 
                filePath = relativePath, 
                workshopId
            });
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpPost("Upload")]
        public async Task<IActionResult> Upload(IFormFile file, [FromForm] Guid workshopId, [FromForm] int fileType, [FromForm] string? title)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded.");
            }
            
            if (workshopId == Guid.Empty)
            {
                return BadRequest("Workshop ID is required.");
            }

            var workshop = await _workshopService.GetAsync(workshopId);
            
            if (workshop is null)
            {
                return NotFound("Workshop not found.");
            }
            
            if (string.IsNullOrEmpty(workshop.FolderName))
            {
                return BadRequest("Workshop folder name is not set.");
            }

            if (!Enum.IsDefined((WorkshopFileTypeEnum)fileType) ||
                !WorkshopUploadValidation.TryGetSafeExtension(file.FileName, (WorkshopFileTypeEnum)fileType, out var extension))
            {
                return BadRequest("The file type or extension is not allowed.");
            }

            var contentsPath = Path.Combine(_environment.ContentRootPath, "Contents");
            var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
            var workshopPath = Path.GetFullPath(Path.Combine(workshopsPath, workshop.FolderName));
            if (!IsPathWithinDirectory(workshopsPath, workshopPath))
            {
                return BadRequest("Workshop folder name is invalid.");
            }

            if (!Directory.Exists(workshopPath))
            {
                Directory.CreateDirectory(workshopPath);
            }

            string subFolder = (WorkshopFileTypeEnum)fileType switch
            {
                WorkshopFileTypeEnum.Photo => "photos",
                WorkshopFileTypeEnum.Material => "tracks",
                _ => ""
            };

            string targetPath;
            string relativePath;

            if (!string.IsNullOrEmpty(subFolder))
            {
                targetPath = Path.Combine(workshopPath, subFolder);
                
                if (!Directory.Exists(targetPath))
                {
                    Directory.CreateDirectory(targetPath);
                }
                
                relativePath = $"/workshops/{workshop.FolderName}/{subFolder}/{Guid.NewGuid():N}{extension}";
            }
            else
            {
                targetPath = workshopPath;
                relativePath = $"/workshops/{workshop.FolderName}/{Guid.NewGuid():N}{extension}";
            }

            var fileName = Path.GetFileName(relativePath);
            var filePath = Path.GetFullPath(Path.Combine(targetPath, fileName));
            if (!IsPathWithinDirectory(workshopsPath, filePath))
            {
                return BadRequest("Upload path is invalid.");
            }

            using (var stream = System.IO.File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }

            var workshopFile = new WorkshopFile
            {
                WorkshopFileId = Guid.NewGuid(),
                WorkshopId = workshopId,
                Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title,
                FileName = fileName,
                FullPath = relativePath,
                FileType = (WorkshopFileTypeEnum)fileType
            };

            await _workshopFileService.CreateAsync(workshopFile);
            
            return Ok(new 
            { 
                fileName,
                filePath = relativePath, 
                workshopId, 
                fileType,
                workshopFileId = workshopFile.WorkshopFileId 
            });
        }

        [Authorize(Policy = WebDevAdminAuthorizationOptions.PolicyName)]
        [HttpDelete("{workshopFileId}")]
        public async Task<IActionResult> Delete(Guid workshopFileId)
        {
            if (workshopFileId == Guid.Empty)
            {
                return BadRequest("WorkshopFile ID is required.");
            }

            var files = await _workshopFileService.GetAsync();
            var workshopFile = files.FirstOrDefault(f => f.WorkshopFileId == workshopFileId);

            if (workshopFile is null)
            {
                return NotFound("WorkshopFile not found.");
            }

            if (!string.IsNullOrEmpty(workshopFile.FullPath))
            {
                var contentsPath = Path.Combine(_environment.ContentRootPath, "Contents");
                var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
                var relativePath = workshopFile.FullPath.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
                var physicalPath = Path.GetFullPath(Path.Combine(contentsPath, relativePath));
                if (!IsPathWithinDirectory(workshopsPath, physicalPath))
                {
                    return BadRequest("Workshop file path is invalid.");
                }

                if (System.IO.File.Exists(physicalPath))
                {
                    System.IO.File.Delete(physicalPath);
                }
            }

            await _workshopFileService.DeleteAsync(workshopFileId);

            return NoContent();
        }

        private static bool IsPathWithinDirectory(string directory, string path)
        {
            var relativePath = Path.GetRelativePath(directory, path);
            return !Path.IsPathRooted(relativePath) &&
                relativePath != "." &&
                relativePath != ".." &&
                !relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal) &&
                !relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}", StringComparison.Ordinal);
        }
    }
}
