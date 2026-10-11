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
}
