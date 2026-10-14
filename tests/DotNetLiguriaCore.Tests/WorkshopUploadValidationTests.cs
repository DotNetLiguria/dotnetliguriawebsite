using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Model;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WorkshopUploadValidationTests
{
    [Theory]
    [InlineData("portrait.PNG", WorkshopFileTypeEnum.Image, ".png")]
    [InlineData("portrait.gif", WorkshopFileTypeEnum.Photo, ".gif")]
    [InlineData("notes.pdf", WorkshopFileTypeEnum.Material, ".pdf")]
    [InlineData("movie.webm", WorkshopFileTypeEnum.Video, ".webm")]
    public void AcceptsAllowedExtensionForFileType(string fileName, WorkshopFileTypeEnum fileType, string expectedExtension)
    {
        Assert.True(WorkshopUploadValidation.TryGetSafeExtension(fileName, fileType, out var extension));
        Assert.Equal(expectedExtension, extension);
    }

    [Theory]
    [InlineData("../outside.png", WorkshopFileTypeEnum.Image)]
    [InlineData("..\\outside.png", WorkshopFileTypeEnum.Image)]
    [InlineData("active.svg", WorkshopFileTypeEnum.Image)]
    [InlineData("wrong-type.pdf", WorkshopFileTypeEnum.Photo)]
    [InlineData("unknown.exe", WorkshopFileTypeEnum.Material)]
    [InlineData("link.pdf", WorkshopFileTypeEnum.Link)]
    public void RejectsUnsafeOrMismatchedUpload(string fileName, WorkshopFileTypeEnum fileType)
    {
        Assert.False(WorkshopUploadValidation.TryGetSafeExtension(fileName, fileType, out _));
    }
}
