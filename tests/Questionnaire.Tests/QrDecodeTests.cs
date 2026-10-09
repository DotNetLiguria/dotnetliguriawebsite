using BlazorAppTest.Server;
using SkiaSharp;
using Xunit;
using ZXing;
using ZXing.Common;

namespace Questionnaire.Tests;

[Trait("Category", "Native")]
public class QrDecodeTests
{
    [Fact]
    public void GeneratedPngRoundTripsThroughNativeDecoderWithoutOwningTheInputStream()
    {
        var writer = new ZXing.SkiaSharp.BarcodeWriter
        {
            Format = BarcodeFormat.QR_CODE,
            Options = new EncodingOptions { Width = 256, Height = 256, Margin = 4 }
        };
        using var bitmap = writer.Write("workshop-fixture");
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        using var stream = data.AsStream();
        Assert.Equal("workshop-fixture", QrPayload.Decode(stream));
        Assert.True(stream.CanRead);
    }

    [Fact]
    public void InvalidImagesHaveNoQrPayload()
    {
        using var stream = new MemoryStream([1, 2, 3, 4]);
        Assert.Null(QrPayload.Decode(stream));
    }
}