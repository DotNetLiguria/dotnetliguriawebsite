using System.Buffers.Binary;
using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Privacy;
using SkiaSharp;
using Xunit;

namespace DotNetLiguriaCore.Tests.Photos;

public sealed class PhotoImageProcessorTests
{
    [Theory]
    [InlineData(1, 0)]
    [InlineData(2, 1)]
    [InlineData(3, 3)]
    [InlineData(4, 2)]
    [InlineData(5, 0)]
    [InlineData(6, 2)]
    [InlineData(7, 3)]
    [InlineData(8, 1)]
    public void Exif_orientation_is_applied_and_not_retained(int orientation, int expectedCorner)
    {
        var jpeg = Quadrants(SKEncodedImageFormat.Jpeg);
        var exif = Convert.FromHexString("FFE1002245786966000049492A0008000000010012010300010000000100000000000000");
        exif[28] = (byte)orientation;
        var input = jpeg[..2].Concat(exif).Concat(jpeg[2..]).ToArray();
        using var sourceStream = new SKMemoryStream(input);
        using (var source = SKCodec.Create(sourceStream))
            Assert.Equal((SKEncodedOrigin)orientation, source.EncodedOrigin);

        var output = PhotoImageProcessor.Process(input, PhotoCrop.Center)[128];
        using var decoded = SKBitmap.Decode(output);
        AssertColor(decoded.GetPixel(32, 32), Colors()[expectedCorner]);
        using var outputStream = new SKMemoryStream(output);
        using var codec = SKCodec.Create(outputStream);
        Assert.Equal(SKEncodedOrigin.TopLeft, codec.EncodedOrigin);
        Assert.True(output.AsSpan().IndexOf("Exif"u8) < 0);
    }

    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 1)]
    [InlineData(0, 1, 2)]
    [InlineData(1, 1, 3)]
    public void Crop_coordinates_select_the_requested_square(float x, float y, int corner)
    {
        var output = PhotoImageProcessor.Process(Quadrants(SKEncodedImageFormat.Png), new(x, y, .5f))[128];
        using var decoded = SKBitmap.Decode(output);
        AssertColor(decoded.GetPixel(64, 64), Colors()[corner]);
    }

    [Theory]
    [InlineData(8193, 1)]
    [InlineData(1, 8193)]
    [InlineData(4001, 4000)]
    public void Oversized_dimensions_and_pixel_counts_are_rejected_before_decoding(uint width, uint height)
    {
        var png = Quadrants(SKEncodedImageFormat.Png);
        BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(16, 4), width);
        BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(20, 4), height);
        var checksum = uint.MaxValue;
        foreach (var value in png.AsSpan(12, 17))
        {
            checksum ^= value;
            for (var bit = 0; bit < 8; bit++)
                checksum = (checksum >> 1) ^ ((checksum & 1) == 0 ? 0 : 0xedb88320u);
        }
        BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(29, 4), ~checksum);
        var error = Assert.Throws<PrivacyBlockedException>(() => PhotoImageProcessor.Process(png, PhotoCrop.Center));
        Assert.Equal("unsupported_photo", error.Code);
    }

    [Fact]
    public void Animated_webp_is_rejected_even_when_each_frame_is_valid()
    {
        var frame = Quadrants(SKEncodedImageFormat.Webp)[12..];
        using var chunks = new MemoryStream();
        using (var writer = new BinaryWriter(chunks, System.Text.Encoding.ASCII, leaveOpen: true))
        {
            Chunk(writer, "VP8X", [2, 0, 0, 0, 31, 0, 0, 31, 0, 0]);
            Chunk(writer, "ANIM", new byte[6]);
            byte[] header = [0, 0, 0, 0, 0, 0, 31, 0, 0, 31, 0, 0, 1, 0, 0, 0];
            Chunk(writer, "ANMF", header.Concat(frame).ToArray());
            Chunk(writer, "ANMF", header.Concat(frame).ToArray());
        }
        using var input = new MemoryStream();
        using (var writer = new BinaryWriter(input, System.Text.Encoding.ASCII, leaveOpen: true))
        {
            writer.Write("RIFF"u8);
            writer.Write((uint)chunks.Length + 4);
            writer.Write("WEBP"u8);
            writer.Write(chunks.ToArray());
        }
        var bytes = input.ToArray();
        using var encodedStream = new SKMemoryStream(bytes);
        using (var codec = SKCodec.Create(encodedStream))
            Assert.Equal(2, codec.FrameCount);
        var error = Assert.Throws<PrivacyBlockedException>(() => PhotoImageProcessor.Process(bytes, PhotoCrop.Center));
        Assert.Equal("unsupported_photo", error.Code);
    }

    private static void Chunk(BinaryWriter writer, string name, byte[] bytes)
    {
        writer.Write(System.Text.Encoding.ASCII.GetBytes(name));
        writer.Write((uint)bytes.Length);
        writer.Write(bytes);
        if (bytes.Length % 2 != 0) writer.Write((byte)0);
    }

    private static SKColor[] Colors() => [SKColors.Red, SKColors.Lime, SKColors.Blue, SKColors.Yellow];

    private static byte[] Quadrants(SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(32, 32);
        using (var canvas = new SKCanvas(bitmap))
        using (var paint = new SKPaint())
            for (var corner = 0; corner < 4; corner++)
            {
                paint.Color = Colors()[corner];
                canvas.DrawRect((corner % 2) * 16, (corner / 2) * 16, 16, 16, paint);
            }
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(format, 100);
        return encoded.ToArray();
    }

    private static void AssertColor(SKColor actual, SKColor expected)
    {
        Assert.InRange(Math.Abs(actual.Red - expected.Red), 0, 25);
        Assert.InRange(Math.Abs(actual.Green - expected.Green), 0, 25);
        Assert.InRange(Math.Abs(actual.Blue - expected.Blue), 0, 25);
    }
}
