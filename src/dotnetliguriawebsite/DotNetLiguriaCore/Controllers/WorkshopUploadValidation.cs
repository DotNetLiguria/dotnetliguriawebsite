using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Controllers;

public static class WorkshopUploadValidation
{
    private static readonly IReadOnlyDictionary<WorkshopFileTypeEnum, HashSet<string>> _allowedExtensions =
        new Dictionary<WorkshopFileTypeEnum, HashSet<string>>
        {
            [WorkshopFileTypeEnum.Image] = [".jpg", ".jpeg", ".png", ".webp", ".gif"],
            [WorkshopFileTypeEnum.Photo] = [".jpg", ".jpeg", ".png", ".webp", ".gif"],
            [WorkshopFileTypeEnum.Video] = [".mp4", ".webm"],
            [WorkshopFileTypeEnum.Material] = [".pdf", ".docx", ".pptx", ".xlsx"],
            [WorkshopFileTypeEnum.Poster] = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]
        };

    public static bool TryGetSafeExtension(string? fileName, WorkshopFileTypeEnum fileType, out string extension)
    {
        extension = string.Empty;

        if (string.IsNullOrWhiteSpace(fileName) ||
            fileName.Contains('/') ||
            fileName.Contains('\\') ||
            !_allowedExtensions.TryGetValue(fileType, out var allowedExtensions))
        {
            return false;
        }

        var candidate = Path.GetExtension(fileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(candidate))
        {
            return false;
        }

        extension = candidate;
        return true;
    }
}
