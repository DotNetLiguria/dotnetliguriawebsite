using System.Buffers.Binary;
using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WorkshopAssetContentTests
{
    [Theory]
    [InlineData(".png")]
    [InlineData(".jpg")]
    [InlineData(".webp")]
    [InlineData(".pdf")]
    [InlineData(".docx")]
    public void RenamedActiveContentIsNotAccepted(string extension) =>
        Assert.False(WorkshopAssetStorage.HasSignature(extension, "<script>alert(1)</script>"u8));

    [Fact]
    public void PngRequiresHeaderAndBoundedDimensions()
    {
        byte[] data = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1];
        Assert.True(WorkshopAssetStorage.HasSignature(".png", data));
        BinaryPrimitives.WriteUInt32BigEndian(data.AsSpan(16, 4), 100_000);
        Assert.False(WorkshopAssetStorage.HasSignature(".png", data));
    }

    [Fact]
    public void TruncatedJpegAndUnscannedOfficeArchivesAreRejected()
    {
        Assert.False(WorkshopAssetStorage.HasSignature(".jpg", new byte[] { 255, 216, 255, 0 }));
        Assert.False(WorkshopAssetStorage.HasSignature(".docx", "PK\u0003\u0004"u8));
        Assert.True(WorkshopAssetStorage.HasSignature(".pdf", "%PDF-1.7"u8));
    }
}
