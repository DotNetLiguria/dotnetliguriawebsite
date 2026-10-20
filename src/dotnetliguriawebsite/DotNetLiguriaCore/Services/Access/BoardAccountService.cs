using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Photos;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Access;

public sealed class BoardAccountService(
    IBoardAccountStore store, IAccessPermissionDirectory directory, PermissionEvaluator evaluator,
    IAccessAuditStore audit, IOptions<PermissionDirectoryOptions> options, TimeProvider clock,
    PhotoLifecycle? photos = null, PrivacyOperationGate? gate = null, PrivacyCoordinator? privacy = null)
{
    private static readonly SemaphoreSlim _changes = new(1, 1);
    private readonly IBoardAccountStore _store = store;
    private readonly IAccessPermissionDirectory _directory = directory;
    private readonly PermissionEvaluator _evaluator = evaluator;
    private readonly IAccessAuditStore _audit = audit;
    private readonly PermissionDirectoryOptions _options = options.Value;
    private readonly TimeProvider _clock = clock;
    private readonly PhotoLifecycle? _photos = photos;
    private readonly PrivacyOperationGate _gate = gate ?? PrivacyOperationGate.Shared;
    private readonly PrivacyCoordinator? _privacy = privacy;

    public async Task<BoardAccountStatus> ReadAsync(ClaimsPrincipal actor, Guid id, CancellationToken cancellationToken)
    {
        await RequireAsync(actor, ["board.read", "access.users.read"], cancellationToken);
        var board = await BoardAsync(id);
        if (board.AccountSubject is null && board.AccountIssuer is null)
        {
            var candidates = string.IsNullOrWhiteSpace(board.Email)
                ? [] : await _directory.FindUsersByEmailAsync(board.Email.Trim(), cancellationToken);
            return new(id, board.Email, null, false, candidates);
        }
        var account = LinkedReference(board);
        var (user, _) = await _directory.GetUserAsync(account, cancellationToken);
        return new(id, board.Email, user, await _directory.IsBoardMemberAsync(account, cancellationToken), []);
    }

    public async Task LinkAsync(ClaimsPrincipal actor, Guid id, BoardAccountLinkRequest request,
        string? confirmation, CancellationToken cancellationToken)
    {
        await RequireAsync(actor, ["board.manage", "access.users.read"], cancellationToken);
        if (!RecentMfa.IsSatisfied(actor, _clock)) throw new PrivacyBlockedException("recent_mfa_required", 403);
        if (confirmation != "link")
            throw new PrivacyBlockedException("explicit_access_confirmation_required", 400);
        await _changes.WaitAsync(cancellationToken);
        try
        {
            using var lease = await _gate.EnterAsync(cancellationToken);
            if (_privacy is not null)
                await _privacy.EnsureAccountActiveAsync(AccountReference.FromPrincipal(actor, _options.Issuer), cancellationToken);
            var board = await BoardAsync(id);
            if (board.AccountIssuer is not null || board.AccountSubject is not null ||
                !string.Equals(board.Email, request.ExpectedEmail, StringComparison.Ordinal))
                throw new PrivacyBlockedException("board_profile_changed", 409);
            var target = Reference(request.Subject);
            var (user, serviceAccount) = await _directory.GetUserAsync(target, cancellationToken);
            if (!user.Enabled || serviceAccount) throw new PrivacyBlockedException("access_target_unavailable", 409);
            if (_privacy is not null) await _privacy.EnsureAccountActiveAsync(target, cancellationToken);
            if (request.MatchEmail)
            {
                var matches = string.IsNullOrWhiteSpace(board.Email) ? []
                    : await _directory.FindUsersByEmailAsync(board.Email.Trim(), cancellationToken);
                if (matches.Count != 1 || matches[0].Subject != target.Subject)
                    throw new PrivacyBlockedException("board_email_match_changed", 409);
            }
            var correlationId = Guid.NewGuid().ToString("N");
            await AuditAsync(actor, target, "board-link", "intent", correlationId, cancellationToken);
            try
            {
                await _store.LinkAsync(id, target, request.ExpectedEmail, cancellationToken);
                var verified = await BoardAsync(id);
                if (verified.AccountIssuer != target.Issuer || verified.AccountSubject != target.Subject)
                    throw new PrivacyBlockedException("board_link_unverified");
                if (_photos is not null) await _photos.AttributeAsync($"board:{id:D}", target, cancellationToken);
                await AuditAsync(actor, target, "board-link", "verified", correlationId, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await AuditAsync(actor, target, "board-link", "unverified", correlationId, cancellationToken);
                throw;
            }
        }
        finally { _changes.Release(); }
    }

    public async Task<BoardAccountStatus> ChangeMembershipAsync(ClaimsPrincipal actor, Guid id,
        BoardMembershipRequest request, string? confirmation, CancellationToken cancellationToken)
    {
        await RequireChangeAsync(actor, request.Join, confirmation, request.Join ? "join" : "leave", cancellationToken);
        await _changes.WaitAsync(cancellationToken);
        try
        {
            var board = await BoardAsync(id);
            var target = LinkedReference(board);
            if (target.Subject != request.Subject) throw new PrivacyBlockedException("board_profile_changed", 409);
            var (user, serviceAccount) = await _directory.GetUserAsync(target, cancellationToken);
            if (serviceAccount || request.Join && !user.Enabled)
                throw new PrivacyBlockedException("access_target_unavailable", 409);
            if (await _directory.IsBoardMemberAsync(target, cancellationToken) != request.ExpectedMember)
                throw new PrivacyBlockedException("board_membership_changed", 409);
            var correlationId = Guid.NewGuid().ToString("N");
            var action = request.Join ? "board-join" : "board-leave";
            await AuditAsync(actor, target, action, "intent", correlationId, cancellationToken);
            try
            {
                await _directory.ChangeBoardMembershipAsync(target, request.Join, cancellationToken);
                if (await _directory.IsBoardMemberAsync(target, cancellationToken) != request.Join)
                    throw new PrivacyBlockedException("board_membership_unverified");
                await AuditAsync(actor, target, action, "verified", correlationId, cancellationToken);
                return new(id, board.Email, user, request.Join, []);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await AuditAsync(actor, target, action, "unverified", correlationId, cancellationToken);
                throw;
            }
        }
        finally { _changes.Release(); }
    }

    private async Task RequireChangeAsync(ClaimsPrincipal actor, bool join, string? confirmation,
        string expectedConfirmation, CancellationToken cancellationToken)
    {
        await RequireAsync(actor, ["board.manage",
            join ? "access.permissions.grant" : "access.permissions.revoke"], cancellationToken);
        if (!RecentMfa.IsSatisfied(actor, _clock)) throw new PrivacyBlockedException("recent_mfa_required", 403);
        if (confirmation != expectedConfirmation)
            throw new PrivacyBlockedException("explicit_access_confirmation_required", 400);
        if (join)
            await RequireAsync(actor, BoardGroupPolicy.Permissions, cancellationToken);
    }

    private async Task RequireAsync(ClaimsPrincipal actor, IEnumerable<string> required, CancellationToken cancellationToken)
    {
        var permissions = await _evaluator.GetAsync(actor, cancellationToken);
        if (required.Any(permission => !permissions.Contains(permission)))
            throw new PrivacyBlockedException("permission_required", 403);
    }

    private async Task<Board> BoardAsync(Guid id) =>
        await _store.GetAsync(id) ?? throw new PrivacyBlockedException("board_profile_not_found", 404);

    private AccountReference Reference(string? subject, string? issuer = null)
    {
        if (issuer is not null && issuer != _options.Issuer ||
            !Guid.TryParse(subject, out var id) || id == Guid.Empty)
            throw new PrivacyBlockedException("invalid_board_account", 409);
        return new(_options.Issuer, id.ToString("D"));
    }

    private AccountReference LinkedReference(Board board)
    {
        if (board.AccountIssuer != _options.Issuer)
            throw new PrivacyBlockedException("invalid_board_account", 409);
        return Reference(board.AccountSubject, board.AccountIssuer);
    }

    private Task AuditAsync(ClaimsPrincipal principal, AccountReference target, string action,
        string outcome, string correlationId, CancellationToken cancellationToken)
    {
        var actor = AccountReference.FromPrincipal(principal, _options.Issuer);
        return _audit.AppendAsync(new(Guid.NewGuid().ToString("N"), _clock.GetUtcNow(), action, "",
            actor.Issuer, actor.Subject, target.Issuer, target.Subject, outcome, correlationId,
            action == "board-link" ? null : _options.BoardGroupId), cancellationToken);
    }
}
