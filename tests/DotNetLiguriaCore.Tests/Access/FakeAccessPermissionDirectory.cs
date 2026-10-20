using System.Collections.Frozen;
using Microsoft.AspNetCore.Http;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Access;

internal sealed class FakeAccessPermissionDirectory : IAccessPermissionDirectory
{
    private readonly Dictionary<string, AccessUserSummary> _users = new(StringComparer.Ordinal);
    private readonly Dictionary<string, HashSet<string>> _direct = new(StringComparer.Ordinal);
    private readonly Dictionary<string, HashSet<string>> _inherited = new(StringComparer.Ordinal);
    private readonly HashSet<string> _serviceAccounts = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> _emails = new(StringComparer.Ordinal);
    public HashSet<string> ProtectedSubjects { get; } = new(StringComparer.Ordinal);
    public int Writes { get; private set; }
    public HashSet<string> BoardSubjects { get; } = new(StringComparer.Ordinal);
    public bool FailBoardWrite { get; set; }
    public bool IgnoreBoardWrite { get; set; }

    public Task<IReadOnlyList<AccessUserSummary>> GetBoardMembersAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccessUserSummary>>(_users.Values.Where(user => BoardSubjects.Contains(user.Subject)).ToArray());

    public Task<bool> IsBoardMemberAsync(AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult(BoardSubjects.Contains(account.Subject));

    public Task ChangeBoardMembershipAsync(AccountReference account, bool join, CancellationToken cancellationToken)
    {
        if (FailBoardWrite) throw new HttpRequestException("Uncertain provider response");
        Writes++;
        if (!IgnoreBoardWrite)
        {
            if (join) BoardSubjects.Add(account.Subject);
            else BoardSubjects.Remove(account.Subject);
        }
        return Task.CompletedTask;
    }

    public void AddUser(
        AccessUserSummary user, IEnumerable<string>? direct = null,
        IEnumerable<string>? inherited = null, bool serviceAccount = false, string? email = null)
    {
        _users[user.Subject] = user;
        _direct[user.Subject] = (direct ?? []).ToHashSet(StringComparer.Ordinal);
        _inherited[user.Subject] = (inherited ?? []).ToHashSet(StringComparer.Ordinal);
        if (serviceAccount) _serviceAccounts.Add(user.Subject);
        else _serviceAccounts.Remove(user.Subject);
        if (email is not null) _emails[user.Subject] = email;
    }

    public Task<IReadOnlySet<string>> GetEffectiveAsync(AccountReference account, CancellationToken cancellationToken)
    {
        Validate(account);
        var effective = Get(_direct, account.Subject);
        effective.UnionWith(Get(_inherited, account.Subject));
        if (BoardSubjects.Contains(account.Subject)) effective.UnionWith(BoardGroupPolicy.Permissions);
        return Task.FromResult<IReadOnlySet<string>>(effective.ToFrozenSet(StringComparer.Ordinal));
    }

    public Task<IReadOnlyList<AccessUserSummary>> SearchUsersAsync(
        string search, int first, int max, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccessUserSummary>>(_users.Values
            .Where(user => user.Username?.Contains(search, StringComparison.OrdinalIgnoreCase) == true)
            .Skip(first).Take(max).ToArray());

    public Task<IReadOnlyList<AccessUserSummary>> FindUsersByEmailAsync(
        string email, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<AccessUserSummary>>(_users.Values.Where(user =>
            _emails.TryGetValue(user.Subject, out var actualEmail) &&
            string.Equals(actualEmail, email, StringComparison.OrdinalIgnoreCase)).ToArray());

    public Task<(AccessUserSummary User, bool IsServiceAccount)> GetUserAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        Validate(account);
        return _users.TryGetValue(account.Subject, out var user)
            ? Task.FromResult((user, _serviceAccounts.Contains(account.Subject)))
            : throw new PrivacyBlockedException("access_target_not_found", StatusCodes.Status404NotFound);
    }

    public async Task<PermissionAssignmentSnapshot> GetAssignmentsAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        Validate(account);
        var direct = Get(_direct, account.Subject).ToFrozenSet(StringComparer.Ordinal);
        var effective = await GetEffectiveAsync(account, cancellationToken);
        var inherited = Get(_inherited, account.Subject).ToFrozenSet(StringComparer.Ordinal);
        return new(direct, inherited, effective);
    }

    public Task<bool> IsProtectedByConfiguredGroupAsync(
        AccountReference account, CancellationToken cancellationToken) =>
        Task.FromResult(ProtectedSubjects.Contains(account.Subject));

    public Task ChangeDirectPermissionAsync(
        AccountReference account, string permission, bool grant, CancellationToken cancellationToken)
    {
        Validate(account);
        if (!_direct.TryGetValue(account.Subject, out var direct))
            _direct[account.Subject] = direct = new(StringComparer.Ordinal);
        if (grant) direct.Add(permission);
        else direct.Remove(permission);
        Writes++;
        return Task.CompletedTask;
    }

    private static HashSet<string> Get(Dictionary<string, HashSet<string>> values, string subject) =>
        values.TryGetValue(subject, out var permissions)
            ? permissions.ToHashSet(StringComparer.Ordinal)
            : new HashSet<string>(StringComparer.Ordinal);

    private static void Validate(AccountReference account)
    {
        if (account.Issuer != AccessManagementServiceTests.Issuer)
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
    }
}
