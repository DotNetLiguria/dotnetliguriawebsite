using Microsoft.Extensions.Options;
using MongoDB.Bson;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class PrivacyCoordinator(
    PrivacyOperationGate gate,
    IErasureJournal journal,
    IAccountPrivacyStore store,
    IIdentityAccountAdmin identities,
    IPrivacySnapshotStore snapshots,
    IOptions<PrivacyOptions> options,
    IRetentionPolicyStore? retentionPolicy = null)
{
    private readonly PrivacyOperationGate _gate = gate;
    private readonly IErasureJournal _journal = journal;
    private readonly IAccountPrivacyStore _store = store;
    private readonly IIdentityAccountAdmin _identities = identities;
    private readonly IPrivacySnapshotStore _snapshots = snapshots;
    private readonly PrivacyOptions _options = options.Value;
    private readonly IRetentionPolicyStore? _retentionPolicy = retentionPolicy;

    // Must be checked inside the same gate lease as every account-linked application write.
    public async Task EnsureAccountActiveAsync(AccountReference account, CancellationToken cancellationToken = default)
    {
        if (await _journal.FindAsync(account, cancellationToken) is not null)
            throw new PrivacyBlockedException("account_erasure_in_progress", StatusCodes.Status409Conflict);
        var profile = await _identities.GetAsync(account, cancellationToken);
        if (profile is null || !profile.Enabled)
            throw new PrivacyBlockedException("account_unavailable", StatusCodes.Status403Forbidden);
    }

    public async Task<string> StatusAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        var operation = await _journal.FindAsync(account, cancellationToken);
        return operation?.Stage ?? "no_pending_request";
    }

    public async Task<object> ExportAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        var profile = await _identities.GetAsync(account, cancellationToken);
        var responses = await _store.ExportAsync(account, cancellationToken);
        return new
        {
            inventoryVersion = ErasureFieldInventory.Version,
            identity = profile is null ? null : new
            {
                profile.FirstName, profile.LastName, profile.Email, profile.EmailVerified,
                consents = profile.Attributes.Where(pair => pair.Key.StartsWith("dnl_notifications_", StringComparison.Ordinal))
                    .ToDictionary(pair => pair.Key, pair => pair.Value)
            },
            // Extended JSON preserves the existing BSON data without resolving any other user's identity.
            responses = responses.Select(document => document.ToJson()).ToArray(),
            warning = "Unattributable legacy data requires a separately approved inventory; this export is not proof of absence."
        };
    }

    public async Task<IReadOnlyList<string>> InspectAsync(AccountReference account, CancellationToken cancellationToken)
    {
        var policy = _retentionPolicy is null ? _options :
            new PrivacyOptions { RetentionOverrides = await _retentionPolicy.ReadAsync(cancellationToken) };
        var blockers = ErasureFieldInventory.BlockingOverrides(policy).Select(field => "retained:" + field).ToList();
        if (!_options.ProtectedStorageApproved) blockers.Add("protected_storage_not_approved");
        if (!_options.ExternalCopiesErasureApproved) blockers.Add("external_copies_erasure_not_approved");
        if (string.IsNullOrWhiteSpace(_options.Issuer) || string.IsNullOrWhiteSpace(_options.AdminClientId) ||
            string.IsNullOrWhiteSpace(_options.AdminClientSecret))
            blockers.Add("identity_admin_not_configured");
        blockers.AddRange(await _store.InspectAsync(account, cancellationToken));
        return blockers;
    }

    public async Task EraseAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        await EraseUnderGateAsync(account, cancellationToken);
    }

    public async Task ResumeAsync(string operationId, CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        var operation = (await _journal.ListAsync(cancellationToken)).SingleOrDefault(item => item.Id == operationId)
            ?? throw new PrivacyBlockedException("operation_not_found", StatusCodes.Status404NotFound);
        await EraseUnderGateAsync(operation.Account, cancellationToken);
    }

    public async Task ReconcileDeletedIdentityAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        if (account.Issuer != _options.Issuer)
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
        if (await _identities.GetAsync(account, cancellationToken) is not null)
            throw new PrivacyBlockedException("identity_must_already_be_deleted", StatusCodes.Status409Conflict);
        await EraseUnderGateAsync(account, cancellationToken);
    }

    private async Task EraseUnderGateAsync(AccountReference account, CancellationToken cancellationToken)
    {
        if (account.Issuer != _options.Issuer)
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
        if (!_options.ProtectedStorageApproved)
            throw new PrivacyBlockedException("protected_storage_not_approved");
        if (!_options.ExternalCopiesErasureApproved)
            throw new PrivacyBlockedException("external_copies_erasure_not_approved");
        // Verify permissions/configuration before recording a destructive operation. A missing account is idempotent.
        _ = await _identities.GetAsync(account, cancellationToken);
        var operation = await _journal.FindAsync(account, cancellationToken) ??
            new ErasureOperation(Guid.NewGuid().ToString("N"), account, "requested");
        await _journal.SaveAsync(operation, cancellationToken);
        var blockers = await InspectAsync(account, cancellationToken);
        if (blockers.Count != 0)
        {
            await _journal.SaveAsync(operation with { Stage = "preflight_blocked" }, cancellationToken);
            throw new PrivacyBlockedException("erasure_preflight_blocked", StatusCodes.Status409Conflict);
        }
        // Last durable stage survives any failure. Retry repeats idempotent work, never claims a transaction.
        await _identities.DisableAsync(account, cancellationToken);
        operation = operation with { Stage = "identity_disabled" };
        await _journal.SaveAsync(operation, cancellationToken);
        await _store.EraseAsync(account, cancellationToken);
        operation = operation with { Stage = "application_erased" };
        await _journal.SaveAsync(operation, cancellationToken);
        await _snapshots.PurgeForErasureUnderGateAsync(cancellationToken);
        operation = operation with { Stage = "snapshots_purged" };
        await _journal.SaveAsync(operation, cancellationToken);
        await _identities.DeleteAsync(account, cancellationToken);
        if (await _identities.GetAsync(account, cancellationToken) is not null)
            throw new PrivacyBlockedException("identity_erasure_not_verified");
        // No completed subject hash, tombstone or per-user audit identifier survives completion.
        await _journal.RemoveAsync(operation, cancellationToken);
    }
}
