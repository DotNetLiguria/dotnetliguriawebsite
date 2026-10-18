using System.Text.Json;
using DotNetLiguriaCore.Services.Notifications;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class NotificationServiceTests
{
    private readonly PrivacyTestClock _clock = new();
    private readonly PrivacyOptions _settings = PrivacyCoordinatorTests.Settings();
    private readonly FakeIdentityAccountAdmin _identities = new();
    private readonly MemoryErasureJournal _journal = new();
    private readonly FakeNotificationCampaignStore _campaigns = new();

    [Fact]
    public async Task OptInRequiresVerifiedEmailAndExplicitCurrentVersion()
    {
        var account = AddAccount("subject", verified: false);
        var service = Service();
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.SetSubscriptionAsync(account,
            new("event-announcements", _settings.ConsentVersion, true), TestContext.Current.CancellationToken));
        _identities.Accounts[account.Subject].EmailVerified = true;
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.SetSubscriptionAsync(account,
            new("event-announcements", "old-version", true), TestContext.Current.CancellationToken));
        await service.SetSubscriptionAsync(account, new("event-announcements", _settings.ConsentVersion, true), TestContext.Current.CancellationToken);
        Assert.True(NotificationConsent.HasCurrentConsent(_identities.Accounts[account.Subject], "event-announcements", _settings.ConsentVersion));
        await service.SetSubscriptionAsync(account, new("event-announcements", "", false), TestContext.Current.CancellationToken);
        Assert.False(NotificationConsent.HasCurrentConsent(_identities.Accounts[account.Subject], "event-announcements", _settings.ConsentVersion));
    }

    [Fact]
    public async Task PreviewContainsMetadataOnlyAndConfirmationNeverClaimsDispatch()
    {
        var admin = AddAccount("administrator");
        var recipient = AddAccount("subscriber");
        Grant(recipient.Subject);
        var unverified = AddAccount("unverified", verified: false);
        Grant(unverified.Subject);
        var pending = AddAccount("erasing");
        Grant(pending.Subject);
        _journal.Operations["pending"] = new("pending", pending, "requested");
        var service = Service();
        var preview = await service.PreviewAsync(admin, new("event-announcements", []), TestContext.Current.CancellationToken);
        Assert.Equal(1, preview.RecipientCount);
        Assert.DoesNotContain("example.test", JsonSerializer.Serialize(preview));
        var blocked = await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ConfirmAsync(admin, preview.Id, TestContext.Current.CancellationToken));
        Assert.Equal(503, blocked.StatusCode);
        Assert.Equal("notification_dispatch_unavailable_no_approved_provider", blocked.Code);
        Assert.Equal("confirmed-awaiting-approved-provider", _campaigns.Campaigns[preview.Id].Status);
    }

    [Fact]
    public async Task WithdrawalAfterPreviewExcludesRecipientAndNoProviderIsInvoked()
    {
        var admin = AddAccount("administrator");
        var recipient = AddAccount("subscriber");
        Grant(recipient.Subject);
        var service = Service();
        var campaign = await service.PreviewAsync(admin, new("event-announcements", []), TestContext.Current.CancellationToken);
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ConfirmAsync(admin, campaign.Id, TestContext.Current.CancellationToken));
        await service.SetSubscriptionAsync(recipient, new("event-announcements", "", false), TestContext.Current.CancellationToken);
        var recipients = new List<NotificationRecipient>();
        await foreach (var item in service.PrepareConfirmedRecipientsAsync(campaign.Id, TestContext.Current.CancellationToken)) recipients.Add(item);
        Assert.Empty(recipients);
    }

    [Fact]
    public async Task RecipientPreparationIsTransientAndRequiresConfirmation()
    {
        var admin = AddAccount("administrator");
        var recipient = AddAccount("subscriber");
        Grant(recipient.Subject);
        var service = Service();
        var campaign = await service.PreviewAsync(admin, new("event-announcements", []), TestContext.Current.CancellationToken);
        await Assert.ThrowsAsync<PrivacyBlockedException>(async () =>
        {
            await foreach (var _ in service.PrepareConfirmedRecipientsAsync(campaign.Id, TestContext.Current.CancellationToken)) { }
        });
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => service.ConfirmAsync(admin, campaign.Id, TestContext.Current.CancellationToken));
        var recipients = new List<NotificationRecipient>();
        await foreach (var item in service.PrepareConfirmedRecipientsAsync(campaign.Id, TestContext.Current.CancellationToken)) recipients.Add(item);
        var resolved = Assert.Single(recipients);
        Assert.Equal("subscriber@example.test", resolved.Email);
        Assert.DoesNotContain("subscriber", resolved.UnsubscribeToken);
        Assert.DoesNotContain("example.test", resolved.ToString());
        Assert.DoesNotContain("example.test", JsonSerializer.Serialize(_campaigns.Campaigns.Values));
    }

    [Fact]
    public async Task TokenIsPurposeBoundTamperResistantExpiringAndCannotOptIn()
    {
        var first = AddAccount("first");
        var second = AddAccount("second");
        Grant(first.Subject);
        Grant(second.Subject);
        var provider = new EphemeralDataProtectionProvider();
        var tokens = new UnsubscribeTokens(provider, _clock, Options.Create(_settings));
        var service = Service(tokens);
        var token = tokens.Create(first, "event-announcements");
        Assert.Equal((first, "event-announcements"), tokens.Validate(token));
        Assert.Throws<PrivacyBlockedException>(() => tokens.Validate(token + "tamper"));
        await service.UnsubscribeAsync(token, TestContext.Current.CancellationToken);
        await service.UnsubscribeAsync(token, TestContext.Current.CancellationToken);
        Assert.False(NotificationConsent.HasCurrentConsent(_identities.Accounts[first.Subject], "event-announcements", _settings.ConsentVersion));
        Assert.True(NotificationConsent.HasCurrentConsent(_identities.Accounts[second.Subject], "event-announcements", _settings.ConsentVersion));
        _clock.Now = _clock.Now.AddDays(31);
        Assert.Throws<PrivacyBlockedException>(() => tokens.Validate(token));
    }

    [Fact]
    public async Task MissingConsentConfigurationIsExplicitlyUnavailable()
    {
        var account = AddAccount("subject");
        _settings.IdentityAttributePermissionsApproved = false;
        var error = await Assert.ThrowsAsync<PrivacyBlockedException>(() => Service().SubscriptionAsync(account, TestContext.Current.CancellationToken));
        Assert.Equal(503, error.StatusCode);
    }

    [Fact]
    public async Task PendingErasureMustNotPreventConsentWithdrawal()
    {
        var account = AddAccount("pending-subject");
        Grant(account.Subject);
        _journal.Operations["pending"] = new("pending", account, "preflight_blocked");
        await Service().SetSubscriptionAsync(account, new("event-announcements", "", false),
            TestContext.Current.CancellationToken);
        Assert.False(NotificationConsent.HasCurrentConsent(_identities.Accounts[account.Subject],
            "event-announcements", _settings.ConsentVersion));
        await Assert.ThrowsAsync<PrivacyBlockedException>(() => Service().SetSubscriptionAsync(account,
            new("event-announcements", _settings.ConsentVersion, true), TestContext.Current.CancellationToken));
    }

    private AccountReference AddAccount(string subject, bool verified = true)
    {
        _identities.Accounts[subject] = new IdentityAccount
        {
            Id = subject, Enabled = true, EmailVerified = verified, Email = subject + "@example.test"
        };
        return new AccountReference(_settings.Issuer, subject);
    }

    private void Grant(string subject) => _identities.Accounts[subject].Attributes["dnl_notifications_events"] =
        [JsonSerializer.Serialize(new NotificationConsent("event-announcements", _settings.ConsentVersion, _clock.Now))];

    private NotificationService Service(UnsubscribeTokens? tokens = null)
    {
        var gate = new PrivacyOperationGate();
        var options = Options.Create(_settings);
        var privacy = new PrivacyCoordinator(gate, _journal, new FakeAccountPrivacyStore(), _identities, new FakePrivacySnapshotStore(), options);
        return new NotificationService(_identities, privacy, gate, _journal, _campaigns,
            tokens ?? new UnsubscribeTokens(new EphemeralDataProtectionProvider(), _clock, options), options, _clock);
    }
}
