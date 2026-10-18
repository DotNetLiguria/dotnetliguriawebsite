using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PrivacyStorageTests : IDisposable
{
    private readonly string _root = Path.GetFullPath(Path.Combine(System.Environment.CurrentDirectory, ".privacy-tests-" + Guid.NewGuid().ToString("N")));

    [Fact]
    public async Task JournalIsProtectedAndCompletionLeavesNoSubjectRecord()
    {
        var settings = Settings();
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), new EphemeralDataProtectionProvider());
        var account = new AccountReference("https://hello.vevy.com/realms/test", "synthetic-subject");
        var operation = new ErasureOperation(Guid.NewGuid().ToString("N"), account, "requested");
        await journal.SaveAsync(operation, TestContext.Current.CancellationToken);
        var path = Directory.EnumerateFiles(Path.Combine(settings.BackupFolder, ".privacy")).Single();
        Assert.DoesNotContain(account.Subject, await File.ReadAllTextAsync(path, TestContext.Current.CancellationToken));
        Assert.Equal(operation, await journal.FindAsync(account, TestContext.Current.CancellationToken));
        await journal.SaveAsync(operation with { Stage = "application_erased" }, TestContext.Current.CancellationToken);
        Assert.Equal("application_erased", (await journal.FindAsync(account, TestContext.Current.CancellationToken))!.Stage);
        await journal.RemoveAsync(operation, TestContext.Current.CancellationToken);
        Assert.Empty(await journal.ListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task UnreadableOrInterruptedJournalBlocksRatherThanDisappearing()
    {
        var settings = Settings();
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), new EphemeralDataProtectionProvider());
        Directory.CreateDirectory(Path.Combine(settings.BackupFolder, ".privacy"));
        await File.WriteAllTextAsync(Path.Combine(settings.BackupFolder, ".privacy", "broken.pending"), "synthetic", TestContext.Current.CancellationToken);
        var exception = await Assert.ThrowsAsync<PrivacyBlockedException>(() => journal.ListAsync(TestContext.Current.CancellationToken));
        Assert.Equal("erasure_journal_recovery_required", exception.Code);
    }

    [Fact]
    public async Task PurgeDeletesRegularSafetyAndUnprovableSnapshotsButNotPendingCoordination()
    {
        var settings = Settings();
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), new EphemeralDataProtectionProvider());
        var operation = new ErasureOperation(Guid.NewGuid().ToString("N"), new("https://hello.vevy.com/realms/test", "synthetic"), "application_erased");
        await journal.SaveAsync(operation, TestContext.Current.CancellationToken);
        foreach (var name in new[] { "20261011T081200000Z-0123abcd", "safety-20261011T081200000Z-0123abcd", "unrecognized-old-copy" })
        {
            Directory.CreateDirectory(Path.Combine(settings.BackupFolder, name));
            await File.WriteAllTextAsync(Path.Combine(settings.BackupFolder, name, "identity.jsonl"), "synthetic", TestContext.Current.CancellationToken);
        }
        await Backup(settings, journal).PurgeForErasureUnderGateAsync(TestContext.Current.CancellationToken);
        Assert.Equal(new[] { ".privacy" }, Directory.EnumerateDirectories(settings.BackupFolder).Select(Path.GetFileName));
        Assert.Equal(operation, await journal.FindAsync(operation.Account, TestContext.Current.CancellationToken));
        Assert.True(File.Exists(Path.Combine(settings.BackupFolder, ".privacy", "backup.epoch")));
    }

    [Fact]
    public async Task LegacySnapshotRestoreIsRejectedBeforeAnyDatabaseConnection()
    {
        var settings = Settings();
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), new EphemeralDataProtectionProvider());
        var id = "20261011T081200000Z-0123abcd";
        var path = Path.Combine(settings.BackupFolder, id);
        Directory.CreateDirectory(path);
        await File.WriteAllTextAsync(Path.Combine(path, "manifest.json"),
            """{"version":1,"createdAtUtc":{"$date":{"$numberLong":"1791712800000"}},"isSafetySnapshot":false,"collections":[]}""", TestContext.Current.CancellationToken);
        var exception = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Backup(settings, journal).RestoreAsync(id, TestContext.Current.CancellationToken));
        Assert.Equal("snapshot_predates_privacy_boundary", exception.Code);
    }

    [Fact]
    public async Task PendingErasureBlocksNewSnapshotsBeforeDatabaseAccess()
    {
        var settings = Settings();
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), new EphemeralDataProtectionProvider());
        await journal.SaveAsync(new(Guid.NewGuid().ToString("N"), new("issuer", "subject"), "requested"), TestContext.Current.CancellationToken);
        var exception = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Backup(settings, journal).CreateAsync(TestContext.Current.CancellationToken));
        Assert.Equal("erasure_in_progress", exception.Code);
    }

    [Fact]
    public async Task RuntimeRetentionOverridesAreDurableAndUnsafeFieldsAreReported()
    {
        var settings = Settings();
        var protection = new EphemeralDataProtectionProvider();
        var options = Options.Create(PrivacyCoordinatorTests.Settings());
        var policies = new FileRetentionPolicyStore(Options.Create(settings), Environment(), options, protection, new());
        var cancellationToken = TestContext.Current.CancellationToken;
        await policies.ReplaceAsync(new() { ["new-schema.Nested.Unknown"] = "retain" }, cancellationToken);
        var reopened = new FileRetentionPolicyStore(Options.Create(settings), Environment(), options, protection, new());
        var read = await reopened.ReadAsync(cancellationToken);
        Assert.Equal("retain", read["new-schema.Nested.Unknown"]);
        Assert.Equal(new[] { "new-schema.Nested.Unknown" },
            ErasureFieldInventory.BlockingOverrides(new PrivacyOptions { RetentionOverrides = read }));
        var journal = new FileErasureJournal(Options.Create(settings), Environment(), protection);
        Assert.Empty(await journal.ListAsync(cancellationToken));
        await reopened.ReplaceAsync(new(), cancellationToken);
        Assert.Empty(await reopened.ReadAsync(cancellationToken));
    }

    private DotNetLiguriaDatabaseSettings Settings() => new()
    {
        BackupFolder = Path.Combine(_root, "backups"), ConnectionString = "mongodb://localhost:27017", DatabaseName = "offline-test"
    };
    private PrivacyTestEnvironment Environment() => new(Path.Combine(_root, "application"));
    private DatabaseBackupService Backup(DotNetLiguriaDatabaseSettings settings, IErasureJournal journal) =>
        new(Options.Create(settings), Environment(), new PrivacyTestClock(), NullLogger<DatabaseBackupService>.Instance,
            new PrivacyOperationGate(), journal, Options.Create(PrivacyCoordinatorTests.Settings()));

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
    }
}
