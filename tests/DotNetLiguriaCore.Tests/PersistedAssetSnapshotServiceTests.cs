using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PersistedAssetSnapshotServiceTests : IDisposable
{
    private readonly string _root = Path.Combine(AppContext.BaseDirectory, "TestArtifacts", "Snapshots", Guid.NewGuid().ToString("N"));
    private CancellationToken CancellationToken => TestContext.Current.CancellationToken;

    public PersistedAssetSnapshotServiceTests() => BsonCompatibility.Configure();

    [Fact]
    public async Task SnapshotValidatesAndRestoresPublicContentsAndPrivateWorkshopUploads()
    {
        var sourceContents = Path.Combine(_root, "source", "contents");
        var sourceUploads = Path.Combine(_root, "source", "private-uploads");
        var targetContents = Path.Combine(_root, "target", "contents");
        var targetUploads = Path.Combine(_root, "target", "private-uploads");
        Directory.CreateDirectory(Path.Combine(sourceContents, "imported", "docs"));
        Directory.CreateDirectory(sourceUploads);

        var publicBytes = "public event file"u8.ToArray();
        var privateBytes = "%PDF-private upload"u8.ToArray();
        await File.WriteAllBytesAsync(Path.Combine(sourceContents, "imported", "docs", "event.pdf"), publicBytes, CancellationToken);
        var uploadId = Guid.NewGuid();
        var uploadName = $"{uploadId:N}.pdf";
        await File.WriteAllBytesAsync(Path.Combine(sourceUploads, uploadName), privateBytes, CancellationToken);

        var publicRecord = new WorkshopFile
        {
            WorkshopFileId = Guid.NewGuid(),
            FileName = "event.pdf",
            FullPath = "/Contents/imported/docs/event.pdf",
            FileType = WorkshopFileTypeEnum.Material,
        };
        var privateRecord = new WorkshopFile
        {
            WorkshopFileId = uploadId,
            FileName = uploadName,
            FullPath = $"/api/WorkshopFile/Download/{uploadId:D}",
            FileType = WorkshopFileTypeEnum.Material,
        };
        var recordsPath = Path.Combine(_root, "workshop-files.jsonl");
        Directory.CreateDirectory(_root);
        var jsonSettings = new JsonWriterSettings { OutputMode = JsonOutputMode.CanonicalExtendedJson };
        await File.WriteAllLinesAsync(recordsPath,
        [
            publicRecord.ToBsonDocument().ToJson(jsonSettings),
            privateRecord.ToBsonDocument().ToJson(jsonSettings),
        ], CancellationToken);

        var source = new PersistedAssetSnapshotService(sourceContents, sourceUploads);
        var snapshotPath = Path.Combine(_root, "snapshot");
        Directory.CreateDirectory(snapshotPath);
        var assetManifest = await source.CaptureAsync(snapshotPath, recordsPath, CancellationToken);
        var manifest = new BsonDocument
        {
            { "contents", assetManifest["contents"] },
            { "workshopUploads", assetManifest["workshopUploads"] },
        };

        await source.ValidateAsync(snapshotPath, manifest, recordsPath, CancellationToken);

        var target = new PersistedAssetSnapshotService(targetContents, targetUploads);
        await target.RestoreAsync(snapshotPath, manifest, CancellationToken);

        Assert.Equal(publicBytes, await File.ReadAllBytesAsync(Path.Combine(targetContents, "imported", "docs", "event.pdf"), CancellationToken));
        Assert.Equal(privateBytes, await File.ReadAllBytesAsync(Path.Combine(targetUploads, uploadName), CancellationToken));
    }

    [Fact]
    public async Task ValidationRejectsChangedSnapshotBytes()
    {
        var contents = Path.Combine(_root, "contents");
        Directory.CreateDirectory(contents);
        await File.WriteAllTextAsync(Path.Combine(contents, "asset.txt"), "original", CancellationToken);
        var snapshotPath = Path.Combine(_root, "snapshot");
        Directory.CreateDirectory(snapshotPath);
        var service = new PersistedAssetSnapshotService(contents, Path.Combine(_root, "uploads"));
        var assets = await service.CaptureAsync(snapshotPath, null, CancellationToken);
        await File.WriteAllTextAsync(Path.Combine(snapshotPath, "contents", "asset.txt"), "modified", CancellationToken);
        var manifest = new BsonDocument
        {
            { "contents", assets["contents"] },
            { "workshopUploads", assets["workshopUploads"] },
        };

        await Assert.ThrowsAsync<InvalidDataException>(() => service.ValidateAsync(snapshotPath, manifest, null, CancellationToken));
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}
