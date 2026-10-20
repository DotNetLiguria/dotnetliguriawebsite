using DotNetLiguriaCore.Services.Privacy;
using SkiaSharp;

namespace DotNetLiguriaCore.Services.Photos;

public sealed class PhotoImageProcessor
{
    public const int MaximumBytes = 5 * 1024 * 1024;

    public static IReadOnlyDictionary<int, byte[]> Process(byte[] input, PhotoCrop crop)
    {
        if (input.Length is 0 or > MaximumBytes ||
            !float.IsFinite(crop.X) || !float.IsFinite(crop.Y) || !float.IsFinite(crop.Size) ||
            crop.X is < 0 or > 1 || crop.Y is < 0 or > 1 || crop.Size is <= 0 or > 1)
            throw new PrivacyBlockedException("invalid_photo_upload", 400);
        using var stream = new SKMemoryStream(input);
        using var codec = SKCodec.Create(stream);
        if (codec is null || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp) ||
            codec.Info.Width is <= 0 or > 8192 || codec.Info.Height is <= 0 or > 8192 ||
            (long)codec.Info.Width * codec.Info.Height > 16_000_000 || codec.FrameCount > 1)
            throw new PrivacyBlockedException("unsupported_photo", 400);
        using var bitmap = new SKBitmap(new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul));
        if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success)
            throw new PrivacyBlockedException("invalid_photo_data", 400);
        using var oriented = Orient(bitmap, codec.EncodedOrigin);
        var side = Math.Min(oriented.Width, oriented.Height) * crop.Size;
        if (side < 1) throw new PrivacyBlockedException("invalid_photo_crop", 400);
        var left = (oriented.Width - side) * crop.X;
        var top = (oriented.Height - side) * crop.Y;
        var source = new SKRect(left, top, left + side, top + side);
        var result = new Dictionary<int, byte[]>();
        foreach (var size in new[] { 128, 512 })
        {
            using var output = new SKBitmap(new SKImageInfo(size, size, SKColorType.Rgba8888, SKAlphaType.Premul));
            using (var canvas = new SKCanvas(output))
            {
                canvas.Clear(SKColors.White);
                canvas.DrawBitmap(oriented, source, new SKRect(0, 0, size, size),
                    new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
            }
            using var image = SKImage.FromBitmap(output);
            using var encoded = image.Encode(SKEncodedImageFormat.Webp, 85)
                ?? throw new IOException("Photo encoding failed.");
            result[size] = encoded.ToArray();
        }
        return result;
    }

    private static SKBitmap Orient(SKBitmap bitmap, SKEncodedOrigin origin)
    {
        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var result = new SKBitmap(swap ? bitmap.Height : bitmap.Width, swap ? bitmap.Width : bitmap.Height);
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
        canvas.DrawBitmap(bitmap, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest, SKMipmapMode.None));
        return result;
    }
}
