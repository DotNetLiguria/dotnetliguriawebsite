using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class FileRetentionPolicyStore(
    IOptions<DotNetLiguriaDatabaseSettings> settings, IHostEnvironment environment,
    IOptions<PrivacyOptions> options, IDataProtectionProvider provider, PrivacyOperationGate gate) : IRetentionPolicyStore
{
    private readonly string _root = Path.Combine(
        PrivacyStoragePaths.ValidateBackupRoot(settings.Value.BackupFolder, environment.ContentRootPath), ".privacy");
    private readonly PrivacyOptions _options = options.Value;
    private readonly IDataProtector _protector = provider.CreateProtector("DotNetLiguria.Privacy.RetentionPolicy.v1");
    private readonly PrivacyOperationGate _gate = gate;

    public async Task<Dictionary<string, string>> ReadAsync(CancellationToken cancellationToken)
    {
        PrivacyStoragePaths.RejectLinks(_root);
        var path = Path.Combine(_root, "retention.policy");
        if (!File.Exists(path)) return new(_options.RetentionOverrides, StringComparer.Ordinal);
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new PrivacyBlockedException("retention_policy_invalid");
        try
        {
            var policy = JsonSerializer.Deserialize<Dictionary<string, string>>(
                _protector.Unprotect(await File.ReadAllTextAsync(path, cancellationToken)));
            Validate(policy);
            return policy!;
        }
        catch (Exception exception) when (exception is JsonException or System.Security.Cryptography.CryptographicException)
        {
            throw new PrivacyBlockedException("retention_policy_unreadable");
        }
    }

    public async Task ReplaceAsync(Dictionary<string, string> overrides, CancellationToken cancellationToken)
    {
        if (!_options.ProtectedStorageApproved) throw new PrivacyBlockedException("protected_storage_not_approved");
        Validate(overrides);
        using var lease = await _gate.EnterAsync(cancellationToken);
        PrivacyStoragePaths.RejectLinks(_root);
        Directory.CreateDirectory(_root);
        var path = Path.Combine(_root, "retention.policy");
        var pending = path + ".pending";
        var bytes = Encoding.UTF8.GetBytes(_protector.Protect(JsonSerializer.Serialize(overrides)));
        await using (var stream = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
        {
            await stream.WriteAsync(bytes, cancellationToken);
            await stream.FlushAsync(cancellationToken);
            stream.Flush(true);
        }
        File.Move(pending, path, true);
    }

    private static void Validate(Dictionary<string, string>? policy)
    {
        if (policy is null || policy.Count > 100 || policy.Any(pair =>
            string.IsNullOrWhiteSpace(pair.Key) || pair.Key.Length > 160 || pair.Key.Any(char.IsControl) ||
            string.IsNullOrWhiteSpace(pair.Value) || pair.Value.Length > 32 || pair.Value.Any(char.IsControl)))
            throw new PrivacyBlockedException("invalid_retention_overrides", StatusCodes.Status400BadRequest);
    }
}
