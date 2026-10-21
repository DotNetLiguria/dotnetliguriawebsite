using SkiaSharp;

namespace DotNetLiguriaCore.Services.Newsletters;

public static class NewsletterImageProcessor
{
    public const int MaximumInputBytes = 2 * 1024 * 1024;
    public const long MaximumPixels = 16_000_000;

    public static NewsletterNormalizedImage Normalize(byte[] input)
    {
        if (input.Length is 0 or > MaximumInputBytes)
            throw new NewsletterServiceException("image_size_exceeded", 400);
        using var stream = new SKMemoryStream(input);
        using var codec = SKCodec.Create(stream);
        if (codec is null || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png) ||
            codec.FrameCount > 1 || codec.Info.Width is <= 0 or > 8192 ||
            codec.Info.Height is <= 0 or > 8192 || (long)codec.Info.Width * codec.Info.Height > MaximumPixels)
            throw new NewsletterServiceException("unsupported_image", 400);

        using var bitmap = new SKBitmap(new SKImageInfo(codec.Info.Width, codec.Info.Height,
            SKColorType.Rgba8888, SKAlphaType.Premul));
        if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success)
            throw new NewsletterServiceException("invalid_image_data", 400);
        using var oriented = Orient(bitmap, codec.EncodedOrigin);
        using var flattened = codec.EncodedFormat == SKEncodedImageFormat.Jpeg
            ? Flatten(oriented) : null;
        using var image = SKImage.FromBitmap(flattened ?? oriented);
        var format = codec.EncodedFormat;
        using var encoded = image.Encode(format, format == SKEncodedImageFormat.Jpeg ? 88 : 100)
            ?? throw new NewsletterServiceException("invalid_image_data", 400);
        var data = encoded.ToArray();
        if (data.Length > MaximumInputBytes)
            throw new NewsletterServiceException("image_size_exceeded", 400);
        return new NewsletterNormalizedImage(data,
            format == SKEncodedImageFormat.Jpeg ? "image/jpeg" : "image/png",
            oriented.Width, oriented.Height);
    }

    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or
            SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var result = new SKBitmap(swap ? source.Height : source.Width, swap ? source.Width : source.Height);
        using var canvas = new SKCanvas(result);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight: canvas.Translate(result.Width, 0); canvas.Scale(-1, 1); break;
            case SKEncodedOrigin.BottomRight: canvas.Translate(result.Width, result.Height); canvas.RotateDegrees(180); break;
            case SKEncodedOrigin.BottomLeft: canvas.Translate(0, result.Height); canvas.Scale(1, -1); break;
            case SKEncodedOrigin.LeftTop: canvas.RotateDegrees(90); canvas.Scale(1, -1); break;
            case SKEncodedOrigin.RightTop: canvas.Translate(result.Width, 0); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.RightBottom: canvas.Translate(result.Width, result.Height); canvas.RotateDegrees(90); canvas.Scale(-1, 1); break;
            case SKEncodedOrigin.LeftBottom: canvas.Translate(0, result.Height); canvas.RotateDegrees(270); break;
        }
        canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None));
        return result;
    }

    private static SKBitmap Flatten(SKBitmap source)
    {
        var result = new SKBitmap(new SKImageInfo(source.Width, source.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
        using var canvas = new SKCanvas(result);
        canvas.Clear(SKColors.White);
        canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None));
        return result;
    }
}
