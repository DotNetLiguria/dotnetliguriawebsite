using System.Runtime.CompilerServices;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Notifications;

public sealed class NotificationService(
    IIdentityAccountAdmin identities, PrivacyCoordinator privacy, PrivacyOperationGate gate,
    IErasureJournal journal, INotificationCampaignStore campaigns, UnsubscribeTokens tokens,
    IOptions<PrivacyOptions> options, TimeProvider clock) : INotificationRecipientPreparation
{
    private readonly IIdentityAccountAdmin _identities = identities;
    private readonly PrivacyCoordinator _privacy = privacy;
    private readonly PrivacyOperationGate _gate = gate;
    private readonly IErasureJournal _journal = journal;
    private readonly INotificationCampaignStore _campaigns = campaigns;
    private readonly UnsubscribeTokens _tokens = tokens;
    private readonly PrivacyOptions _options = options.Value;
    private readonly TimeProvider _clock = clock;

    public async Task SetSubscriptionAsync(AccountReference account, NotificationSubscriptionRequest request, CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        _ = NotificationConsent.AttributeFor(request.Purpose);
        using var lease = await _gate.EnterAsync(cancellationToken);
        if (request.OptIn)
            await _privacy.EnsureAccountActiveAsync(account, cancellationToken);
        var profile = await _identities.GetAsync(account, cancellationToken)
            ?? throw new PrivacyBlockedException("account_unavailable", 409);
        if (request.OptIn && (!profile.CanReceiveNotifications || request.Version != _options.ConsentVersion))
            throw new PrivacyBlockedException("verified_email_and_current_consent_required", 409);
        var evidence = request.OptIn
            ? JsonSerializer.Serialize(new NotificationConsent(request.Purpose, _options.ConsentVersion, _clock.GetUtcNow()))
            : null;
        await _identities.SetConsentAsync(account, request.Purpose, evidence, cancellationToken);
    }

    public async Task<object> SubscriptionAsync(AccountReference account, CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        using var lease = await _gate.EnterAsync(cancellationToken);
        var profile = await _identities.GetAsync(account, cancellationToken);
        return new
        {
            version = _options.ConsentVersion,
            monthlyUpcomingEvents = profile is not null && NotificationConsent.HasCurrentConsent(profile, "monthly-upcoming-events", _options.ConsentVersion),
            eventAnnouncements = profile is not null && NotificationConsent.HasCurrentConsent(profile, "event-announcements", _options.ConsentVersion)
        };
    }

    public async Task UnsubscribeAsync(string token, CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        var payload = _tokens.Validate(token);
        using var lease = await _gate.EnterAsync(cancellationToken);
        // Deleted users need no mutation; tokens cannot create accounts or opt anyone in.
        if (await _identities.GetAsync(payload.Account, cancellationToken) is not null)
            await _identities.SetConsentAsync(payload.Account, payload.Purpose, null, cancellationToken);
    }

    public async Task<NotificationCampaign> PreviewAsync(AccountReference administrator, NotificationCampaignRequest request, CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        _ = NotificationConsent.AttributeFor(request.Purpose);
        using var lease = await _gate.EnterAsync(cancellationToken);
        await _privacy.EnsureAccountActiveAsync(administrator, cancellationToken);
        var events = await _campaigns.ResolveEventsAsync(request, _clock.GetUtcNow(), cancellationToken);
        var pending = (await _journal.ListAsync(cancellationToken)).Select(operation => operation.Account).ToHashSet();
        var count = 0;
        await foreach (var profile in _identities.ListAsync(cancellationToken))
            if (NotificationConsent.HasCurrentConsent(profile, request.Purpose, _options.ConsentVersion) &&
                !pending.Contains(new AccountReference(_options.Issuer, profile.Id))) count++;
        var campaign = new NotificationCampaign(Guid.NewGuid().ToString("N"), request.Purpose, events,
            _clock.GetUtcNow(), _clock.GetUtcNow().AddMinutes(30), count, administrator.ActorKey, "preview");
        await _campaigns.SaveAsync(campaign, cancellationToken);
        return campaign;
    }

    public async Task ConfirmAsync(AccountReference administrator, string id, CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        using var lease = await _gate.EnterAsync(cancellationToken);
        await _privacy.EnsureAccountActiveAsync(administrator, cancellationToken);
        var campaign = await GetCurrentCampaignAsync(id, cancellationToken);
        await _campaigns.SaveAsync(campaign with { Status = "confirmed-awaiting-approved-provider" }, cancellationToken);
        // This installation has no approved delivery adapter. Confirmation is not delivery.
        throw new PrivacyBlockedException("notification_dispatch_unavailable_no_approved_provider");
    }

    public async IAsyncEnumerable<NotificationRecipient> PrepareConfirmedRecipientsAsync(
        string campaignId, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        EnsureConsentConfigured();
        using var lease = await _gate.EnterAsync(cancellationToken);
        var campaign = await GetCurrentCampaignAsync(campaignId, cancellationToken);
        if (campaign.Status != "confirmed-awaiting-approved-provider")
            throw new PrivacyBlockedException("campaign_confirmation_required", 409);
        var pending = (await _journal.ListAsync(cancellationToken)).Select(operation => operation.Account).ToHashSet();
        await foreach (var listed in _identities.ListAsync(cancellationToken))
        {
            var account = new AccountReference(_options.Issuer, listed.Id);
            if (pending.Contains(account) || !NotificationConsent.HasCurrentConsent(listed, campaign.Purpose, _options.ConsentVersion)) continue;
            // Re-resolve just before preparation; old directory pages/preview counts do not authorize a disclosure.
            var current = await _identities.GetAsync(account, cancellationToken);
            if (current is not null && NotificationConsent.HasCurrentConsent(current, campaign.Purpose, _options.ConsentVersion))
                yield return new NotificationRecipient(current.Email!, _tokens.Create(account, campaign.Purpose));
        }
    }

    private async Task<NotificationCampaign> GetCurrentCampaignAsync(string id, CancellationToken cancellationToken)
    {
        var campaign = await _campaigns.GetAsync(id, cancellationToken)
            ?? throw new PrivacyBlockedException("campaign_not_found", 404);
        if (campaign.ExpiresAt <= _clock.GetUtcNow()) throw new PrivacyBlockedException("campaign_expired", 409);
        return campaign;
    }

    private void EnsureConsentConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.ConsentVersion) || !_options.IdentityAttributePermissionsApproved)
            throw new PrivacyBlockedException("notification_consent_not_configured");
    }
}
