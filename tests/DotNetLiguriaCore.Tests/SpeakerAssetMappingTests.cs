using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DataMigration;
using DotNetLiguria.Models;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class SpeakerAssetMappingTests : IDisposable
{
    private readonly string _root = Path.Combine(AppContext.BaseDirectory, "TestArtifacts", "SpeakerAssets", Guid.NewGuid().ToString("N"));

    private (WorkshopSpeaker Source, VerifiedSpeakerAsset Asset) Create(string name, string file, string contents)
    {
        Directory.CreateDirectory(Path.Combine(_root, "speakers"));
        var source = new WorkshopSpeaker { WorkshopSpeakerId = Guid.NewGuid(), Name = name, ProfileImage = $"/Uploads/speakers/{file}" };
        var bytes = Encoding.UTF8.GetBytes(contents);
        File.WriteAllBytes(Path.Combine(_root, "speakers", file), bytes);
        return (source, new VerifiedSpeakerAsset
        {
            SpeakerId = source.WorkshopSpeakerId, Name = name, SourcePath = source.ProfileImage,
            SourceUrl = "https://www.dotnetliguria.net" + source.ProfileImage, Path = "speakers/" + file,
            Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes)), Bytes = bytes.Length
        });
    }

    [Fact]
    public void VerifiedImagesUseExplicitIdentityPathsRegardlessOfExportOrder()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        var b = Create("Fixture Beta", "beta.jpg", "portrait-b");
        var manifest = JsonSerializer.Deserialize<SpeakerAssetManifest>(JsonSerializer.Serialize(
            new SpeakerAssetManifest { VerifiedAssets = [a.Asset, b.Asset] }))!;
        var result = SpeakerAssetMapping.ValidateAndMap([b.Source, a.Source], manifest, _root);
        Assert.Equal("/Contents/speakers/alpha.jpg", result[a.Source.WorkshopSpeakerId]);
        Assert.Equal("/Contents/speakers/beta.jpg", result[b.Source.WorkshopSpeakerId]);
        Assert.Equal("/Uploads/speakers/alpha.jpg", a.Source.ProfileImage);
    }

    [Fact]
    public void SwappedFileBytesAreRejectedEvenWhenNamesAndFileSizesLookCorrect()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        var b = Create("Fixture Beta", "beta.jpg", "portrait-b");
        File.WriteAllText(Path.Combine(_root, "speakers", "alpha.jpg"), "portrait-b");
        File.WriteAllText(Path.Combine(_root, "speakers", "beta.jpg"), "portrait-a");
        var error = Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap(
            [a.Source, b.Source], new() { VerifiedAssets = [a.Asset, b.Asset] }, _root));
        Assert.Contains("hash mismatch", error.Message);
    }

    [Fact]
    public void AssigningAnotherExportedIdentityToAnAssetIsRejected()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        var b = Create("Fixture Beta", "beta.jpg", "portrait-b");
        a.Asset.SpeakerId = b.Source.WorkshopSpeakerId;
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap(
            [a.Source, b.Source], new() { VerifiedAssets = [a.Asset, b.Asset] }, _root));
    }

    [Fact]
    public void MissingProvenanceAndChangedSourceUrlsBlockMapping()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], new(), _root));
        a.Asset.SourceUrl = "https://www.dotnetliguria.net/Uploads/speakers/other.jpg";
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], new() { VerifiedAssets = [a.Asset] }, _root));
    }

    [Fact]
    public void DuplicateDestinationsAndDuplicateManifestIdentitiesAreRejected()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        var b = Create("Fixture Beta", "beta.jpg", "portrait-b");
        b.Asset.Path = a.Asset.Path;
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source, b.Source], new() { VerifiedAssets = [a.Asset, b.Asset] }, _root));
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], new() { VerifiedAssets = [a.Asset, a.Asset] }, _root));
    }

    [Theory]
    [InlineData("../outside.jpg")]
    [InlineData("speakers/../outside.jpg")]
    [InlineData("/outside.jpg")]
    [InlineData("speakers\\alpha.jpg")]
    public void UnsafeOrNonportablePathsAreRejected(string path)
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        a.Asset.Path = path;
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], new() { VerifiedAssets = [a.Asset] }, _root));
    }

    [Fact]
    public void MissingFileIsRejectedBeforeMappingReturns()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        File.Delete(Path.Combine(_root, "speakers", "alpha.jpg"));
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], new() { VerifiedAssets = [a.Asset] }, _root));
    }

    [Fact]
    public void ReviewedUnavailablePhotoMapsToNoImageAndRetainsItsSourceMetadata()
    {
        var a = Create("Fixture Alpha", "alpha.jpg", "portrait-a");
        var unavailable = new UnavailableSpeakerAsset
        {
            SpeakerId = a.Source.WorkshopSpeakerId, Name = a.Source.Name!, SourcePath = a.Source.ProfileImage!,
            SourceUrl = a.Asset.SourceUrl, HttpStatus = 404
        };
        var manifest = new SpeakerAssetManifest { UnavailableMedia = [unavailable] };
        Assert.Null(SpeakerAssetMapping.ValidateAndMap([a.Source], manifest, _root)[a.Source.WorkshopSpeakerId]);
        Assert.Equal("/Uploads/speakers/alpha.jpg", a.Source.ProfileImage);
        unavailable.HttpStatus = 500;
        Assert.Throws<InvalidOperationException>(() => SpeakerAssetMapping.ValidateAndMap([a.Source], manifest, _root));
    }

    [Fact]
    public void SpeakersWithoutSourcePhotosNeedNoInventedMapping()
    {
        Directory.CreateDirectory(_root);
        var source = new WorkshopSpeaker { WorkshopSpeakerId = Guid.NewGuid(), Name = "Fixture Alpha" };
        Assert.Null(SpeakerAssetMapping.ValidateAndMap([source], new(), _root)[source.WorkshopSpeakerId]);
    }

    public void Dispose()
    {
        var resolved = Path.GetFullPath(_root);
        var expectedRoot = Path.Combine(AppContext.BaseDirectory, "TestArtifacts", "SpeakerAssets") + Path.DirectorySeparatorChar;
        if (!resolved.StartsWith(expectedRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Test directory is outside its intended temporary location.");
        if (Directory.Exists(resolved)) Directory.Delete(resolved, recursive: true);
    }
}
