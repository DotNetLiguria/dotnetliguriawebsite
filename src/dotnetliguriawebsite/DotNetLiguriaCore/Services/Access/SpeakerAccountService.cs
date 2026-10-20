using System.Net.Mail;
using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Photos;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Access;

public sealed class SpeakerAccountService(
    ISpeakerAccountStore store, IAccessPermissionDirectory directory, ISpeakerOnboardingDirectory onboarding,
    PermissionEvaluator evaluator, IAccessAuditStore audit, IOptions<PermissionDirectoryOptions> options, TimeProvider clock,
    PhotoLifecycle? photos = null, PrivacyOperationGate? gate = null, PrivacyCoordinator? privacy = null)
{
    private static readonly SemaphoreSlim _changes = new(1, 1);
    private readonly ISpeakerAccountStore _store = store;
    private readonly IAccessPermissionDirectory _directory = directory;
    private readonly ISpeakerOnboardingDirectory _onboarding = onboarding;
    private readonly PermissionEvaluator _evaluator = evaluator;
    private readonly IAccessAuditStore _audit = audit;
    private readonly PermissionDirectoryOptions _options = options.Value;
    private readonly TimeProvider _clock = clock;
    private readonly PhotoLifecycle? _photos = photos;
    private readonly PrivacyOperationGate _gate = gate ?? PrivacyOperationGate.Shared;
    private readonly PrivacyCoordinator? _privacy = privacy;

    public async Task<SpeakerAccountStatus> ReadAsync(ClaimsPrincipal actor, Guid id, CancellationToken token)
    {
        await RequireAsync(actor, ["speakers.read", "access.users.read"], token);
        return await StatusAsync(id, token);
    }

    public async Task LinkAsync(ClaimsPrincipal actor, Guid id, SpeakerAccountLinkRequest request,
        string? confirmation, CancellationToken token)
    {
        await RequireChangeAsync(actor, "link", confirmation, token);
        await _changes.WaitAsync(token);
        try
        {
            using var lease = await _gate.EnterAsync(token);
            await EnsureActiveAsync(AccountReference.FromPrincipal(actor, _options.Issuer), token);
            var profile = await ProfileAsync(id);
            var email = ValidateUnlinked(profile, request.ExpectedEmail);
            var account = Reference(request.Subject);
            var matches = await _directory.FindUsersByEmailAsync(email, token);
            if (matches.Count != 1 || matches[0].Subject != account.Subject || !matches[0].Enabled ||
                matches[0].Issuer != account.Issuer)
                throw new PrivacyBlockedException("speaker_email_match_changed", 409);
            await RequireHumanAsync(account, token);
            await EnsureActiveAsync(account, token);
            var correlation = Guid.NewGuid().ToString("N");
            await AuditAsync(actor, account.Subject, "speaker-link", "intent", correlation, token);
            try
            {
                await _store.LinkAsync(id, account, request.ExpectedEmail, token);
                await VerifyLinkAsync(id, account);
                if (_photos is not null) await _photos.AttributeAsync($"speaker:{id:D}", account, token);
                await AuditAsync(actor, account.Subject, "speaker-link", "verified", correlation, token);
            }
            catch (Exception) when (!token.IsCancellationRequested)
            {
                await AuditAsync(actor, account.Subject, "speaker-link", "unverified", correlation, token);
                throw;
            }
        }
        finally { _changes.Release(); }
    }

    public async Task<SpeakerAccountStatus> CreateAndInviteAsync(ClaimsPrincipal actor, Guid id,
        SpeakerAccountCreateRequest request, string? confirmation, CancellationToken token)
    {
        await RequireChangeAsync(actor, "create-and-invite", confirmation, token);
        _onboarding.ValidateInvitationConfiguration();
        await _changes.WaitAsync(token);
        try
        {
            using var lease = await _gate.EnterAsync(token);
            await EnsureActiveAsync(AccountReference.FromPrincipal(actor, _options.Issuer), token);
            var profile = await ProfileAsync(id);
            var email = ValidateUnlinked(profile, request.ExpectedEmail);
            if (await _store.GetOperationAsync(id, token) is not null)
                throw new PrivacyBlockedException("speaker_account_creation_already_attempted", 409);
            if ((await _directory.FindUsersByEmailAsync(email, token)).Count != 0)
                throw new PrivacyBlockedException("speaker_existing_account_requires_link", 409);
            await _store.RequireIdentityIndexAsync(token);
            var operation = new SpeakerOnboardingOperation(Guid.NewGuid().ToString("N"), email, "create-pending", null, _options.Issuer);
            await AuditAsync(actor, "", "speaker-create", "intent", operation.CorrelationId, token);
            await _store.ReserveCreationAsync(id, operation, token);
            AccountReference account;
            try
            {
                account = await _onboarding.CreateSpeakerAccountAsync(email, token);
                operation = operation with { State = "created", Subject = account.Subject };
                await _store.SaveOperationAsync(id, operation, token);
                await EnsureActiveAsync(account, token);
                var created = await _onboarding.ReadInvitationAccountAsync(account, token);
                var matches = await _directory.FindUsersByEmailAsync(email, token);
                if (!created.Enabled || created.IsServiceAccount || !SameEmail(created.Email, email) ||
                    !created.RequiredActions.Contains("UPDATE_PASSWORD") || !created.RequiredActions.Contains("VERIFY_EMAIL") ||
                    matches.Count != 1 || matches[0].Subject != account.Subject)
                    throw new PrivacyBlockedException("speaker_account_create_unverified");
                await AuditAsync(actor, account.Subject, "speaker-create", "verified", operation.CorrelationId, token);
            }
            catch (Exception) when (!token.IsCancellationRequested)
            {
                operation = operation with { State = operation.Subject is null ? "create-uncertain" : "created-unverified" };
                await _store.SaveOperationAsync(id, operation, token);
                await AuditAsync(actor, operation.Subject ?? "", "speaker-create", "unverified", operation.CorrelationId, token);
                throw new PrivacyBlockedException("speaker_account_create_uncertain", 409);
            }
            await AuditAsync(actor, account.Subject, "speaker-link", "intent", operation.CorrelationId, token);
            try
            {
                await _store.LinkAsync(id, account, request.ExpectedEmail, token);
                await VerifyLinkAsync(id, account);
                if (_photos is not null) await _photos.AttributeAsync($"speaker:{id:D}", account, token);
                await AuditAsync(actor, account.Subject, "speaker-link", "verified", operation.CorrelationId, token);
            }
            catch (Exception) when (!token.IsCancellationRequested)
            {
                await AuditAsync(actor, account.Subject, "speaker-link", "unverified", operation.CorrelationId, token);
                throw;
            }
            await InviteAsync(actor, id, account, operation, token);
            return await StatusAsync(id, token);
        }
        finally { _changes.Release(); }
    }

    public async Task<SpeakerAccountStatus> ResendInvitationAsync(ClaimsPrincipal actor, Guid id,
        SpeakerAccountLinkRequest request, string? confirmation, CancellationToken token)
    {
        await RequireChangeAsync(actor, "resend-invitation", confirmation, token);
        _onboarding.ValidateInvitationConfiguration();
        await _changes.WaitAsync(token);
        try
        {
            using var lease = await _gate.EnterAsync(token);
            await EnsureActiveAsync(AccountReference.FromPrincipal(actor, _options.Issuer), token);
            var profile = await ProfileAsync(id);
            var account = LinkedReference(profile);
            await EnsureActiveAsync(account, token);
            var operation = await _store.GetOperationAsync(id, token);
            if (operation is null || operation.Issuer != account.Issuer ||
                operation.Subject != account.Subject || request.Subject != account.Subject ||
                operation.State is not ("created" or "invitation-failed" or "invitation-pending" or "invited") ||
                profile.Email != request.ExpectedEmail || !SameEmail(operation.Email, profile.Email))
                throw new PrivacyBlockedException("speaker_invitation_not_resendable", 409);
            await InviteAsync(actor, id, account, operation, token);
            return await StatusAsync(id, token);
        }
        finally { _changes.Release(); }
    }

    private async Task InviteAsync(ClaimsPrincipal actor, Guid id, AccountReference account,
        SpeakerOnboardingOperation operation, CancellationToken token)
    {
        await RequireHumanAsync(account, token);
        var before = await _onboarding.ReadInvitationAccountAsync(account, token);
        if (!before.Enabled || before.IsServiceAccount || !SameEmail(before.Email, operation.Email) ||
            before.RequiredActions.Count == 0)
            throw new PrivacyBlockedException("speaker_invitation_not_needed_or_changed", 409);
        var correlation = Guid.NewGuid().ToString("N");
        await AuditAsync(actor, account.Subject, "speaker-invite", "intent", correlation, token);
        await _store.SaveOperationAsync(id, operation with { State = "invitation-pending" }, token);
        try
        {
            await _onboarding.SendSpeakerInvitationAsync(account, before.RequiredActions, token);
            var after = await _onboarding.ReadInvitationAccountAsync(account, token);
            if (!after.Enabled || after.IsServiceAccount || !SameEmail(after.Email, operation.Email))
                throw new PrivacyBlockedException("speaker_invitation_unverified");
            await _store.SaveOperationAsync(id, operation with { State = "invited" }, token);
            await AuditAsync(actor, account.Subject, "speaker-invite", "accepted", correlation, token);
        }
        catch (Exception) when (!token.IsCancellationRequested)
        {
            await _store.SaveOperationAsync(id, operation with { State = "invitation-failed" }, token);
            await AuditAsync(actor, account.Subject, "speaker-invite", "unverified", correlation, token);
            // The account and its immutable link remain valid; only an explicit resend may retry email.
        }
    }

    private async Task<SpeakerAccountStatus> StatusAsync(Guid id, CancellationToken token)
    {
        var profile = await ProfileAsync(id);
        var operation = await _store.GetOperationAsync(id, token);
        if (profile.AccountIssuer is null && profile.AccountSubject is null)
            return new(id, profile.Email, null, string.IsNullOrWhiteSpace(profile.Email) ? [] :
                await _directory.FindUsersByEmailAsync(profile.Email.Trim(), token), operation?.State);
        var account = LinkedReference(profile);
        var (user, _) = await _directory.GetUserAsync(account, token);
        return new(id, profile.Email, user, [], operation?.State);
    }

    private async Task RequireChangeAsync(ClaimsPrincipal actor, string action, string? confirmation, CancellationToken token)
    {
        await RequireAsync(actor, action == "link" ? ["speakers.manage", "access.users.read"] :
            ["speakers.manage", "access.users.read", "access.users.create"], token);
        if (!RecentMfa.IsSatisfied(actor, _clock)) throw new PrivacyBlockedException("recent_mfa_required", 403);
        if (confirmation != action) throw new PrivacyBlockedException("explicit_access_confirmation_required", 400);
    }

    private async Task RequireAsync(ClaimsPrincipal actor, string[] required, CancellationToken token)
    {
        var permissions = await _evaluator.GetAsync(actor, token);
        if (required.Any(permission => !permissions.Contains(permission)))
            throw new PrivacyBlockedException("permission_required", 403);
    }

    private async Task RequireHumanAsync(AccountReference account, CancellationToken token)
    {
        var (user, serviceAccount) = await _directory.GetUserAsync(account, token);
        if (!user.Enabled || serviceAccount) throw new PrivacyBlockedException("access_target_unavailable", 409);
    }

    private Task EnsureActiveAsync(AccountReference account, CancellationToken token) =>
        _privacy?.EnsureAccountActiveAsync(account, token) ?? Task.CompletedTask;

    private async Task<WorkshopSpeaker> ProfileAsync(Guid id) =>
        await _store.GetAsync(id) ?? throw new PrivacyBlockedException("speaker_profile_not_found", 404);

    private static string ValidateUnlinked(WorkshopSpeaker profile, string? expectedEmail)
    {
        if (profile.AccountIssuer is not null || profile.AccountSubject is not null || profile.Email != expectedEmail)
            throw new PrivacyBlockedException("speaker_profile_changed", 409);
        var email = profile.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 160 || email.Any(char.IsControl) ||
            !MailAddress.TryCreate(email, out var address) || address.Address != email)
            throw new PrivacyBlockedException("speaker_email_invalid", 400);
        return email;
    }

    private AccountReference Reference(string subject)
    {
        if (!Guid.TryParseExact(subject, "D", out var id) || id == Guid.Empty || string.IsNullOrWhiteSpace(_options.Issuer))
            throw new PrivacyBlockedException("invalid_speaker_account", 409);
        return new(_options.Issuer, id.ToString("D"));
    }

    private AccountReference LinkedReference(WorkshopSpeaker profile)
    {
        if (profile.AccountIssuer != _options.Issuer || profile.AccountSubject is null)
            throw new PrivacyBlockedException("invalid_speaker_account", 409);
        return Reference(profile.AccountSubject);
    }

    private async Task VerifyLinkAsync(Guid id, AccountReference account)
    {
        var profile = await ProfileAsync(id);
        if (profile.AccountIssuer != account.Issuer || profile.AccountSubject != account.Subject)
            throw new PrivacyBlockedException("speaker_link_unverified");
    }

    private static bool SameEmail(string? left, string? right) =>
        string.Equals(left?.Trim(), right?.Trim(), StringComparison.OrdinalIgnoreCase);

    private Task AuditAsync(ClaimsPrincipal principal, string subject, string action, string outcome,
        string correlation, CancellationToken token)
    {
        var actor = AccountReference.FromPrincipal(principal, _options.Issuer);
        return _audit.AppendAsync(new(Guid.NewGuid().ToString("N"), _clock.GetUtcNow(), action, "",
            actor.Issuer, actor.Subject, _options.Issuer, subject, outcome, correlation), token);
    }
}
