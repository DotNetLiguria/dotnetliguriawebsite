using DotNetLiguriaCore.Services;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class DatabaseBackupServiceTests
{
    [Theory]
    [InlineData("20261011T081200000Z-0123abcd", true)]
    [InlineData("safety-20261011T081200000Z-0123abcd", true)]
    [InlineData("../20261011T081200000Z-0123abcd", false)]
    [InlineData("20261011T081200000Z-0123ABCD", false)]
    [InlineData("20261011T081200000Z-0123abcd/collection-0000.jsonl", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void SnapshotIdentifiersOnlyAcceptGeneratedSafeValues(string? snapshotId, bool expected)
    {
        Assert.Equal(expected, DatabaseBackupService.IsValidSnapshotId(snapshotId));
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("", true)]
    [InlineData("Before importing the archive", true)]
    [InlineData("Archive / 2020", true)]
    [InlineData("Invalid\nname", false)]
    [InlineData("Invalid\u0000name", false)]
    public void BackupNamesAreOptionalDisplayTextNotSnapshotIdentifiers(string? name, bool expected)
    {
        Assert.Equal(expected, DatabaseBackupService.IsValidSnapshotName(name));
    }

    [Fact]
    public void BackupNameLengthIsBounded()
    {
        Assert.True(DatabaseBackupService.IsValidSnapshotName(new string('a', 120)));
        Assert.False(DatabaseBackupService.IsValidSnapshotName(new string('a', 121)));
    }
}
