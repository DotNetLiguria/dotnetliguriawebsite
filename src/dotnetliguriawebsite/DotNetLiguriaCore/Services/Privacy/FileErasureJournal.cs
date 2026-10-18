using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class FileErasureJournal(
    IOptions<DotNetLiguriaDatabaseSettings> settings,
    IHostEnvironment environment,
    IDataProtectionProvider protectionProvider) : IErasureJournal
{
    private readonly string _root = Path.Combine(
        PrivacyStoragePaths.ValidateBackupRoot(settings.Value.BackupFolder, environment.ContentRootPath), ".privacy");
    private readonly IDataProtector _protector = protectionProvider.CreateProtector("DotNetLiguria.Privacy.PendingErasure.v1");

    public async Task<ErasureOperation?> FindAsync(AccountReference account, CancellationToken cancellationToken) =>
        (await ListAsync(cancellationToken)).SingleOrDefault(operation => operation.Account == account);

    public async Task<IReadOnlyList<ErasureOperation>> ListAsync(CancellationToken cancellationToken)
    {
        PrivacyStoragePaths.RejectLinks(_root);
        if (!Directory.Exists(_root)) return [];
        var result = new List<ErasureOperation>();
        foreach (var path in Directory.EnumerateFiles(_root))
        {
            cancellationToken.ThrowIfCancellationRequested();
            if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new PrivacyBlockedException("erasure_journal_invalid");
            if (Path.GetFileName(path) == "backup.epoch")
            {
                if (!Guid.TryParseExact(await File.ReadAllTextAsync(path, cancellationToken), "N", out _))
                    throw new PrivacyBlockedException("invalid_backup_privacy_epoch");
                continue;
            }
            if (Path.GetFileName(path) == "retention.policy") continue;
            // Interrupted atomic writes also block restores until an operator resolves them.
            if (!path.EndsWith(".operation", StringComparison.Ordinal))
                throw new PrivacyBlockedException("erasure_journal_recovery_required");
            try
            {
                var operation = JsonSerializer.Deserialize<ErasureOperation>(
                    _protector.Unprotect(await File.ReadAllTextAsync(path, cancellationToken)));
                if (operation is null || !Guid.TryParseExact(operation.Id, "N", out _) ||
                    Path.GetFileName(path) != operation.Id + ".operation")
                    throw new PrivacyBlockedException("erasure_journal_invalid");
                result.Add(operation);
            }
            catch (Exception exception) when (exception is System.Security.Cryptography.CryptographicException or JsonException)
            {
                throw new PrivacyBlockedException("erasure_journal_unreadable");
            }
        }
        if (Directory.EnumerateDirectories(_root).Any())
            throw new PrivacyBlockedException("erasure_journal_invalid");
        return result;
    }

    public async Task SaveAsync(ErasureOperation operation, CancellationToken cancellationToken)
    {
        var path = GetPath(operation);
        PrivacyStoragePaths.RejectLinks(_root);
        Directory.CreateDirectory(_root);
        var pending = path + ".pending";
        var bytes = System.Text.Encoding.UTF8.GetBytes(_protector.Protect(JsonSerializer.Serialize(operation)));
        await using (var stream = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            4096, FileOptions.WriteThrough | FileOptions.Asynchronous))
        {
            await stream.WriteAsync(bytes, cancellationToken);
            await stream.FlushAsync(cancellationToken);
            stream.Flush(true);
        }
        File.Move(pending, path, true);
    }

    public Task RemoveAsync(ErasureOperation operation, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        PrivacyStoragePaths.RejectLinks(_root);
        File.Delete(GetPath(operation));
        return Task.CompletedTask;
    }

    private string GetPath(ErasureOperation operation)
    {
        if (!Guid.TryParseExact(operation.Id, "N", out _))
            throw new PrivacyBlockedException("erasure_journal_invalid");
        return Path.Combine(_root, operation.Id + ".operation");
    }
}
