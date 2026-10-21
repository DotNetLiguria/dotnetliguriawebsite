using DotNetLiguriaCore.Services.Newsletters;
using SkiaSharp;
using Xunit;

namespace DotNetLiguriaCore.Tests.Newsletters;

public sealed class NewsletterImageProcessorTests
{
    [Fact]
    public void NormalizesPngAndPreservesDimensions()
    {
        var input = Png();

        var image = NewsletterImageProcessor.Normalize(input);

        Assert.Equal("image/png", image.ContentType);
        Assert.Equal(20, image.Width);
        Assert.Equal(10, image.Height);
        Assert.NotEmpty(image.Data);
    }

    [Fact]
    public void RejectsInvalidOrOversizedImageData()
    {
        Assert.Equal("unsupported_image", Assert.Throws<NewsletterServiceException>(() =>
            NewsletterImageProcessor.Normalize([1, 2, 3, 4])).Code);
        Assert.Equal("image_size_exceeded", Assert.Throws<NewsletterServiceException>(() =>
            NewsletterImageProcessor.Normalize(new byte[NewsletterImageProcessor.MaximumInputBytes + 1])).Code);
    }

    [Fact]
    public void RejectsInputsAboveConfiguredPixelBudget()
    {
        using var bitmap = new SKBitmap(new SKImageInfo(4096, 4096));
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        var exception = Assert.Throws<NewsletterServiceException>(() =>
            NewsletterImageProcessor.Normalize(encoded.ToArray()));
        Assert.Equal("unsupported_image", exception.Code);
    }

    private static byte[] Png()
    {
        using var bitmap = new SKBitmap(new SKImageInfo(20, 10));
        bitmap.Erase(SKColors.White);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        return encoded.ToArray();
    }
}
