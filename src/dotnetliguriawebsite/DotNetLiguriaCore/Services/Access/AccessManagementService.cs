using System.Collections.Concurrent;
using System.Collections.Frozen;
using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Access;

public sealed class AccessManagementService(
    IAccessPermissionDirectory directory,
    PermissionEvaluator permissionEvaluator,
    IAccessAuditStore audit,
    IOptions<PermissionDirectoryOptions> options,
    TimeProvider timeProvider)
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _targetLocks = new(StringComparer.Ordinal);
    private static readonly FrozenSet<string> _protectedPermissions = new[]
    {
        "backups.restore"
    }.ToFrozenSet(StringComparer.Ordinal);
    private readonly IAccessPermissionDirectory _directory = directory;
    private readonly PermissionEvaluator _permissionEvaluator = permissionEvaluator;
    private readonly IAccessAuditStore _audit = audit;
    private readonly PermissionDirectoryOptions _options = options.Value;
    private readonly TimeProvider _timeProvider = timeProvider;

    public IReadOnlyList<AccessPermissionInfo> Permissions() =>
        PermissionCatalog.Ids.Select(id => new AccessPermissionInfo(id, PermissionDelegationPolicy.IsDelegable(id)))
            .ToArray();

    public async Task<AccessUserSearchPage> SearchUsersAsync(
        string search, int first, int max, CancellationToken cancellationToken)
    {
        if (search.Length > 100 ||
            search.Any(char.IsControl) || first < 0 || first > 10000 || max is < 1 or > 50)
            throw new PrivacyBlockedException("invalid_access_search", StatusCodes.Status400BadRequest);
        var users = await _directory.SearchUsersAsync(search.Trim(), first, max + 1, cancellationToken);
        var pageUsers = users.Take(max).ToArray();
        return new(pageUsers, first, max, users.Count > max);
    }

    public async Task<AccessUserDetails> GetUserAsync(
        ClaimsPrincipal actorPrincipal, string subject, CancellationToken cancellationToken)
    {
        var actor = AccountReference.FromPrincipal(actorPrincipal, _options.Issuer);
        var target = Target(subject);
        var (user, isServiceAccount) = await _directory.GetUserAsync(target, cancellationToken);
        var assignments = await _directory.GetAssignmentsAsync(target, cancellationToken);
        var protectedTarget = await IsProtectedTargetAsync(target, isServiceAccount, assignments, cancellationToken);
        var actorPermissions = await _permissionEvaluator.GetAsync(actorPrincipal, cancellationToken);
        var canGrant = actorPermissions.Contains("access.permissions.grant");
        var canRevoke = actorPermissions.Contains("access.permissions.revoke");
        var self = SameAccount(actor, target);
        var grantable = PermissionDelegationPolicy.DelegableIds
            .Where(permission => user.Enabled && !protectedTarget && !self &&
                canGrant && actorPermissions.Contains(permission) &&
                !assignments.DirectPermissions.Contains(permission))
            .ToFrozenSet(StringComparer.Ordinal);
        var revocable = PermissionDelegationPolicy.DelegableIds
            .Where(permission => user.Enabled && !protectedTarget && !self &&
                canRevoke && actorPermissions.Contains(permission) &&
                assignments.DirectPermissions.Contains(permission))
            .ToFrozenSet(StringComparer.Ordinal);
        return new(user.Issuer, user.Subject, user.Username, user.Enabled,
            assignments.DirectPermissions, assignments.InheritedPermissions, assignments.EffectivePermissions,
            protectedTarget, self, canGrant, canRevoke, grantable, revocable);
    }

    public async Task<AccessPermissionChangeResult> ChangePermissionAsync(
        ClaimsPrincipal actorPrincipal,
        string subject,
        string permission,
        bool grant,
        IReadOnlyCollection<string> expectedDirectPermissions,
        string? confirmation,
        CancellationToken cancellationToken)
    {
        var action = grant ? "grant" : "revoke";
        var actor = AccountReference.FromPrincipal(actorPrincipal, _options.Issuer);
        var target = Target(subject);
        if (SameAccount(actor, target))
            throw new PrivacyBlockedException("self_access_change_forbidden", StatusCodes.Status403Forbidden);
        if (!PermissionDelegationPolicy.IsDelegable(permission))
            throw new PrivacyBlockedException("permission_not_delegable", StatusCodes.Status403Forbidden);
        if (!RecentMfa.IsSatisfied(actorPrincipal, _timeProvider))
            throw new PrivacyBlockedException("recent_mfa_required", StatusCodes.Status403Forbidden);
        if (!string.Equals(confirmation, action, StringComparison.Ordinal))
            throw new PrivacyBlockedException("explicit_access_confirmation_required", StatusCodes.Status400BadRequest);
        ValidateExpected(expectedDirectPermissions);

        var actorPermissions = await _permissionEvaluator.GetAsync(actorPrincipal, cancellationToken);
        var requiredAccessPermission = grant ? "access.permissions.grant" : "access.permissions.revoke";
        if (!actorPermissions.Contains("access.users.read") ||
            !actorPermissions.Contains(requiredAccessPermission) ||
            !actorPermissions.Contains(permission))
            throw new PrivacyBlockedException("access_change_forbidden", StatusCodes.Status403Forbidden);

        var lockKey = actor.Issuer + "|" + target.Subject;
        var targetLock = _targetLocks.GetOrAdd(lockKey, static _ => new SemaphoreSlim(1, 1));
        await targetLock.WaitAsync(cancellationToken);
        try
        {
            var (user, isServiceAccount) = await _directory.GetUserAsync(target, cancellationToken);
            if (!user.Enabled)
                throw new PrivacyBlockedException("access_target_unavailable", StatusCodes.Status409Conflict);
            var current = await _directory.GetAssignmentsAsync(target, cancellationToken);
            if (await IsProtectedTargetAsync(target, isServiceAccount, current, cancellationToken))
                throw new PrivacyBlockedException("protected_access_target", StatusCodes.Status403Forbidden);
            if (!expectedDirectPermissions.ToHashSet(StringComparer.Ordinal).SetEquals(current.DirectPermissions))
                throw new PrivacyBlockedException("access_assignment_changed", StatusCodes.Status409Conflict);

            var isDirect = current.DirectPermissions.Contains(permission);
            if (grant && isDirect)
                return Result(target, current, changed: false, "");
            if (!grant && !isDirect)
                throw new PrivacyBlockedException(current.InheritedPermissions.Contains(permission)
                    ? "permission_remains_inherited"
                    : "permission_not_directly_assigned", StatusCodes.Status409Conflict);

            var correlationId = Guid.NewGuid().ToString("N");
            await _audit.AppendAsync(AuditEntry(correlationId, "intent", action, permission, actor, target),
                cancellationToken);
            try
            {
                await _directory.ChangeDirectPermissionAsync(target, permission, grant, cancellationToken);
                var verified = await _directory.GetAssignmentsAsync(target, cancellationToken);
                var expectedAfter = current.DirectPermissions.ToHashSet(StringComparer.Ordinal);
                if (grant) expectedAfter.Add(permission);
                else expectedAfter.Remove(permission);
                if (!expectedAfter.SetEquals(verified.DirectPermissions) ||
                    verified.DirectPermissions.Contains(permission) != grant ||
                    (grant && !verified.EffectivePermissions.Contains(permission)))
                    throw new PrivacyBlockedException("access_change_not_verified", StatusCodes.Status503ServiceUnavailable);
                await _audit.AppendAsync(AuditEntry(correlationId, "verified", action, permission, actor, target),
                    cancellationToken);
                return Result(target, verified, changed: true, correlationId);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                await _audit.AppendAsync(AuditEntry(correlationId, "unverified", action, permission, actor, target),
                    cancellationToken);
                if (exception is PrivacyBlockedException)
                    throw;
                throw new PrivacyBlockedException("access_change_unverified");
            }
        }
        finally
        {
            targetLock.Release();
        }
    }

    public async Task<AccessAuditPage> ReadAuditAsync(
        int first, int max, CancellationToken cancellationToken)
    {
        if (first < 0 || first > 10000 || max is < 1 or > 100)
            throw new PrivacyBlockedException("invalid_access_audit_page", StatusCodes.Status400BadRequest);
        var rows = await _audit.RecentAsync(first + max + 1, cancellationToken);
        var entries = rows.Skip(first).Take(max).ToArray();
        var usernames = new Dictionary<string, string?>(StringComparer.Ordinal);
        foreach (var subject in entries.SelectMany(entry => new[] { entry.ActorSubject, entry.TargetSubject }).Distinct(StringComparer.Ordinal))
            usernames[subject] = await TryResolveUsernameAsync(subject, cancellationToken);
        var views = entries.Select(entry => new AccessAuditView(entry.At, entry.Action, entry.Permission,
            entry.ActorSubject, usernames.GetValueOrDefault(entry.ActorSubject),
            entry.TargetSubject, usernames.GetValueOrDefault(entry.TargetSubject),
            entry.Outcome, entry.CorrelationId)).ToArray();
        return new(views, first, max, rows.Count > first + max);
    }

    // Names are display hints only: a deleted account or a directory outage must not hide the history.
    private async Task<string?> TryResolveUsernameAsync(string subject, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(subject, out var subjectGuid)) return null;
        try
        {
            var (user, _) = await _directory.GetUserAsync(
                new(_options.Issuer, subjectGuid.ToString("D")), cancellationToken);
            return user.Username;
        }
        catch (PrivacyBlockedException)
        {
            return null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    private async Task<bool> IsProtectedTargetAsync(
        AccountReference target,
        bool isServiceAccount,
        PermissionAssignmentSnapshot assignments,
        CancellationToken cancellationToken)
    {
        if (isServiceAccount || assignments.EffectivePermissions.Any(permission =>
            permission.StartsWith("access.", StringComparison.Ordinal) ||
            permission.StartsWith("maintenance.", StringComparison.Ordinal) ||
            permission.StartsWith("privacy.", StringComparison.Ordinal) ||
            _protectedPermissions.Contains(permission)))
            return true;
        return await _directory.IsProtectedByConfiguredGroupAsync(target, cancellationToken);
    }

    private AccountReference Target(string subject)
    {
        if (!Guid.TryParse(subject, out var subjectGuid))
            throw new PrivacyBlockedException("invalid_access_target", StatusCodes.Status400BadRequest);
        return new(_options.Issuer, subjectGuid.ToString("D"));
    }

    private static bool SameAccount(AccountReference left, AccountReference right) =>
        string.Equals(left.Issuer, right.Issuer, StringComparison.Ordinal) &&
        string.Equals(left.Subject, right.Subject, StringComparison.Ordinal);

    private static void ValidateExpected(IReadOnlyCollection<string> expected)
    {
        if (expected.Count > PermissionCatalog.Ids.Count ||
            expected.Any(permission => !PermissionCatalog.IsKnown(permission)) ||
            expected.Count != expected.Distinct(StringComparer.Ordinal).Count())
            throw new PrivacyBlockedException("invalid_expected_access_snapshot", StatusCodes.Status400BadRequest);
    }

    private static AccessPermissionChangeResult Result(
        AccountReference target, PermissionAssignmentSnapshot snapshot, bool changed, string correlationId) =>
        new(target.Issuer, target.Subject, snapshot.DirectPermissions, snapshot.InheritedPermissions,
            snapshot.EffectivePermissions, changed, correlationId);

    private AccessAuditEntry AuditEntry(
        string correlationId, string outcome, string action, string permission,
        AccountReference actor, AccountReference target) =>
        new(Guid.NewGuid().ToString("N"), _timeProvider.GetUtcNow(), action, permission,
            actor.Issuer, actor.Subject, target.Issuer, target.Subject, outcome, correlationId);
}
