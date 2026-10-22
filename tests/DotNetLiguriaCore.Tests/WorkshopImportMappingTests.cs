using DataMigration;
using DotNetLiguria.Models;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WorkshopImportMappingTests
{
    [Fact]
    public void AnotherEventOwningImportFolderBlocksImport()
    {
        var historical = new Workshop { WorkshopId = Guid.NewGuid() };
        var testEvent = new DotNetLiguria.MongoDBModel.Workshop { WorkshopId = Guid.NewGuid(), FolderName = "workshop001" };
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.ValidateFolderOwnership([historical], [testEvent], new Dictionary<Guid, string> { [historical.WorkshopId] = "workshop001" }));
    }

    [Fact]
    public void ExistingEventCannotBeMovedByChangingExportPosition()
    {
        var source = new Workshop { WorkshopId = Guid.NewGuid() };
        var existing = new DotNetLiguria.MongoDBModel.Workshop { WorkshopId = source.WorkshopId, FolderName = "workshop002" };
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.ValidateFolderOwnership([source], [existing], new Dictionary<Guid, string> { [source.WorkshopId] = "workshop001" }));
    }

    [Fact]
    public void SameEventMayReuseItsOwnFolder()
    {
        var source = new Workshop { WorkshopId = Guid.NewGuid() };
        var existing = new DotNetLiguria.MongoDBModel.Workshop { WorkshopId = source.WorkshopId, FolderName = "workshop001" };
        WorkshopImportMapping.ValidateFolderOwnership([source], [existing], new Dictionary<Guid, string> { [source.WorkshopId] = "workshop001" });
    }

    [Fact]
    public void LegacyPathResolvesMissingWorkshopIdAndPreservesExportFileId()
    {
        var workshop = new Workshop { WorkshopId = Guid.NewGuid() };
        var id = Guid.NewGuid();
        var file = new WorkshopFile { WorkshopFileId = id, FileName = "slides.pdf", FileType = WorkshopFileType.Material,
            FullPath = $"/Uploads/workshops/{workshop.WorkshopId}\\slides.pdf" };

        var result = Assert.Single(WorkshopImportMapping.MapFiles([workshop], [file], new Dictionary<Guid, string> { [workshop.WorkshopId] = "workshop001" }));

        Assert.Equal(workshop.WorkshopId, result.WorkshopId);
        Assert.Equal(id, result.WorkshopFileId);
        Assert.Equal("/workshops/workshop001/tracks/slides.pdf", result.FullPath);
    }

    [Fact]
    public void MissingFileIdIsStableAcrossRuns()
    {
        var workshop = new Workshop { WorkshopId = Guid.NewGuid() };
        var file = new WorkshopFile { Workshop_WorkshopId = workshop.WorkshopId, FileName = "photo.jpg", FileType = WorkshopFileType.Photo };
        var folders = new Dictionary<Guid, string> { [workshop.WorkshopId] = "workshop001" };
        var first = Assert.Single(WorkshopImportMapping.MapFiles([workshop], [file], folders));
        var second = Assert.Single(WorkshopImportMapping.MapFiles([workshop], [file], folders));
        Assert.Equal(first.WorkshopFileId, second.WorkshopFileId);
        Assert.Equal("/workshops/workshop001/photos/photo.jpg", first.FullPath);
    }

    [Fact]
    public void UnmatchedFileFailsBeforeImport()
    {
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.MapFiles([], [new WorkshopFile { FileName = "orphan.pdf" }], new Dictionary<Guid, string>()));
    }

    [Fact]
    public void TracksMustExistInBothExportsWithSameWorkshop()
    {
        var workshop = new Workshop { WorkshopId = Guid.NewGuid(), Tracks = [] };
        var track = new WorkshopTrack { WorkshopId = workshop.WorkshopId, WorkshopTrackId = Guid.NewGuid() };
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.ValidateTracks([workshop], [track]));
        workshop.Tracks.Add(track);
        WorkshopImportMapping.ValidateTracks([workshop], [track]);
    }

    [Fact]
    public void InsertingAnEarlierEventCannotReassignAnExistingAsset()
    {
        var original = new Workshop { WorkshopId = Guid.NewGuid(), EventDate = new DateTime(2026, 3, 5) };
        var earlier = new Workshop { WorkshopId = Guid.NewGuid(), EventDate = new DateTime(2010, 1, 1) };
        var file = new WorkshopFile { Workshop_WorkshopId = original.WorkshopId, FileName = "slides.pdf", FileType = WorkshopFileType.Material };
        var folders = new Dictionary<Guid, string> { [original.WorkshopId] = "workshop043", [earlier.WorkshopId] = "workshop045" };
        var first = Assert.Single(WorkshopImportMapping.MapFiles([original], [file], folders));
        var second = Assert.Single(WorkshopImportMapping.MapFiles([earlier, original], [file], folders));
        Assert.Equal(first.FullPath, second.FullPath);
    }

    [Fact]
    public void RecoveredFileUsesItsVerifiedIdPathInsteadOfChronologicalFolder()
    {
        var source = new Workshop { WorkshopId = Guid.NewGuid() };
        var id = Guid.NewGuid();
        var file = new WorkshopFile { WorkshopFileId = id, Workshop_WorkshopId = source.WorkshopId, FileName = "slides.pdf", FileType = WorkshopFileType.Material };
        var folderMap = new Dictionary<Guid, string> { [source.WorkshopId] = "workshop043" };
        var path = $"/imported/files/{id}/slides.pdf";
        var result = Assert.Single(WorkshopImportMapping.MapFiles([source], [file], folderMap, new Dictionary<Guid, string> { [id] = path }));
        Assert.Equal(path, result.FullPath);
        Assert.Equal(source.WorkshopId, result.WorkshopId);
    }

    [Fact]
    public void ExplicitRepairCanSeparateImportedEventFromTestWithoutReusingTestFolder()
    {
        var source = new Workshop { WorkshopId = Guid.NewGuid() };
        var imported = new DotNetLiguria.MongoDBModel.Workshop { WorkshopId = source.WorkshopId, FolderName = "workshop043" };
        var test = new DotNetLiguria.MongoDBModel.Workshop { WorkshopId = Guid.NewGuid(), FolderName = "workshop043" };
        var folders = new Dictionary<Guid, string> { [source.WorkshopId] = $"workshop-{source.WorkshopId:D}" };
        WorkshopImportMapping.ValidateFolderOwnership([source], [imported, test], folders, allowFolderMove: true);
        folders[source.WorkshopId] = "workshop043";
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.ValidateFolderOwnership([source], [imported, test], folders, allowFolderMove: true));
    }

    [Theory]
    [InlineData("../workshop043")]
    [InlineData("workshop043/other")]
    [InlineData("workshop043\\other")]
    public void FolderMapCannotEscapeAssetDirectory(string folder)
    {
        var source = new Workshop { WorkshopId = Guid.NewGuid() };
        Assert.Throws<InvalidOperationException>(() => WorkshopImportMapping.ValidateFolderOwnership([source], [], new Dictionary<Guid, string> { [source.WorkshopId] = folder }));
    }
}
