using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Privacy.Notices;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PrivacyNoticeTests
{
    [Fact]
    public async Task SmtpAcceptanceIsPersistedAndNotRepeated()
    {
        var journal = PendingJournal();
        var sender = new FakeAdminPrivacyNoticeSender();
        var clock = new PrivacyTestClock();
        var worker = Worker(journal, sender, clock);
        await worker.ProcessPendingAsync(TestContext.Current.CancellationToken);
        await worker.ProcessPendingAsync(TestContext.Current.CancellationToken);
        var operation = Assert.Single(journal.Operations.Values);
        Assert.Equal("accepted_by_smtp", operation.NoticeStatus);
        Assert.Equal(1, operation.NoticeAttempts);
        Assert.Null(operation.NoticeNextAttemptAt);
        Assert.Null(operation.NoticeErrorCode);
        Assert.Null(operation.NoticeAttemptToken);
        Assert.Equal(1, sender.Calls);
    }

    [Fact]
    public async Task RetriesSurviveRestartAndStopAtBound()
    {
        var journal = PendingJournal();
        var sender = new FakeAdminPrivacyNoticeSender
        {
            Send = _ => Task.FromResult(new PrivacyNoticeSendResult(false, "smtp_tls_failed"))
        };
        var clock = new PrivacyTestClock();
        for (var attempt = 1; attempt <= PrivacyNoticeWorker.MaximumAttempts; attempt++)
        {
            await Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken);
            var operation = Assert.Single(journal.Operations.Values);
            Assert.Equal(attempt, operation.NoticeAttempts);
            Assert.Equal("failed", operation.NoticeStatus);
            Assert.Equal("smtp_tls_failed", operation.NoticeErrorCode);
            if (attempt < PrivacyNoticeWorker.MaximumAttempts)
            {
                Assert.Equal(clock.Now.AddMinutes(1 << (attempt - 1)), operation.NoticeNextAttemptAt);
                await Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken);
                Assert.Equal(attempt, sender.Calls);
                clock.Now = operation.NoticeNextAttemptAt!.Value;
            }
            else Assert.Null(operation.NoticeNextAttemptAt);
        }
        clock.Now = clock.Now.AddDays(30);
        await Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Equal(PrivacyNoticeWorker.MaximumAttempts, sender.Calls);
    }

    [Fact]
    public async Task RemovedOperationIsNotRecreatedAndGateIsNotHeldWhileSending()
    {
        var journal = PendingJournal();
        var gate = new PrivacyOperationGate();
        var sender = new FakeAdminPrivacyNoticeSender();
        sender.Send = async cancellationToken =>
        {
            var enter = gate.EnterAsync(cancellationToken);
            Assert.True(enter.IsCompletedSuccessfully);
            using var lease = await enter;
            await journal.RemoveAsync(Assert.Single(journal.Operations.Values), cancellationToken);
            return new(true, null);
        };
        await Worker(journal, sender, new PrivacyTestClock(), gate).ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Empty(journal.Operations);
    }

    [Fact]
    public async Task ConcurrentRetryIsNotOverwrittenByOldTransportResult()
    {
        var journal = PendingJournal();
        var sender = new FakeAdminPrivacyNoticeSender
        {
            Send = async cancellationToken =>
            {
                var current = Assert.Single(journal.Operations.Values);
                await journal.SaveAsync(current with
                {
                    NoticeStatus = "queued", NoticeAttempts = 0, NoticeNextAttemptAt = null,
                    NoticeErrorCode = null, NoticeAttemptToken = null
                }, cancellationToken);
                return new(true, null);
            }
        };
        await Worker(journal, sender, new PrivacyTestClock()).ProcessPendingAsync(TestContext.Current.CancellationToken);
        var operation = Assert.Single(journal.Operations.Values);
        Assert.Equal("queued", operation.NoticeStatus);
        Assert.Equal(0, operation.NoticeAttempts);
    }

    [Fact]
    public async Task InterruptedAttemptIsDurableAndRecoversAfterLease()
    {
        var journal = PendingJournal();
        var clock = new PrivacyTestClock();
        var sender = new FakeAdminPrivacyNoticeSender
        {
            Send = _ => Task.FromCanceled<PrivacyNoticeSendResult>(new CancellationToken(true))
        };
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken));
        var reserved = Assert.Single(journal.Operations.Values);
        Assert.Equal("smtp_outcome_unknown", reserved.NoticeErrorCode);
        Assert.NotNull(reserved.NoticeAttemptToken);
        sender.Send = _ => Task.FromResult(new PrivacyNoticeSendResult(true, null));
        await Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Equal(1, sender.Calls);
        clock.Now = reserved.NoticeNextAttemptAt!.Value;
        await Worker(journal, sender, clock).ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Equal("accepted_by_smtp", Assert.Single(journal.Operations.Values).NoticeStatus);
    }

    [Theory]
    [InlineData("website_erased", "queued", 0)]
    [InlineData("awaiting_manual_identity_removal", "not_required", 0)]
    [InlineData("awaiting_manual_identity_removal", "accepted_by_smtp", 0)]
    [InlineData("awaiting_manual_identity_removal", "failed", 0)]
    [InlineData("identity_verification_blocked", "queued", 1)]
    public async Task OnlyExplicitPendingWorkIsSent(string stage, string status, int calls)
    {
        var journal = PendingJournal();
        var operation = Assert.Single(journal.Operations.Values);
        journal.Operations[operation.Id] = operation with
        {
            Stage = stage, NoticeStatus = status, NoticeAttempts = status == "failed" ? 5 : 0
        };
        var sender = new FakeAdminPrivacyNoticeSender();
        await Worker(journal, sender, new PrivacyTestClock()).ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Equal(calls, sender.Calls);
    }

    [Fact]
    public async Task GenericMessageContainsOnlyTrustedDashboardAndAdministratorAddress()
    {
        var configuration = ValidOptions();
        var transport = new FakePrivacySmtpTransport();
        var sender = new AdminPrivacyNoticeSender(new NoticeOptionsMonitor(configuration), transport,
            new PrivacyTestClock());
        Assert.True((await sender.SendAsync(TestContext.Current.CancellationToken)).Accepted);
        Assert.Contains(configuration.DashboardUrl, transport.MessageText);
        Assert.Contains("richieste privacy", transport.MessageText, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("subject-sensitive", transport.MessageText);
        Assert.DoesNotContain("operation-sensitive", transport.MessageText);
        Assert.DoesNotContain("account-sensitive", transport.MessageText);
        Assert.DoesNotContain("runtime-secret", transport.MessageText);
        Assert.DoesNotContain("user@example.test", transport.MessageText);
    }

    [Fact]
    public async Task MissingConfigurationIsVisibleOnJournalAndHealthWithoutTransport()
    {
        var journal = PendingJournal();
        var clock = new PrivacyTestClock();
        var options = new NoticeOptionsMonitor(new PrivacySmtpOptions());
        var transport = new FakePrivacySmtpTransport();
        var sender = new AdminPrivacyNoticeSender(options, transport, clock);
        var gate = new PrivacyOperationGate();
        var worker = Worker(journal, sender, clock, gate);
        await worker.ProcessPendingAsync(TestContext.Current.CancellationToken);
        Assert.Equal("smtp_not_configured", Assert.Single(journal.Operations.Values).NoticeErrorCode);
        Assert.Equal(0, transport.Calls);
        var health = await new PrivacySmtpHealthCheck(options, journal, gate, worker)
            .CheckHealthAsync(new HealthCheckContext(), TestContext.Current.CancellationToken);
        Assert.Equal(HealthStatus.Degraded, health.Status);
        Assert.Equal("smtp_not_configured", health.Description);
    }

    [Theory]
    [InlineData("tls")]
    [InlineData("port")]
    [InlineData("sender")]
    [InlineData("recipient")]
    [InlineData("http")]
    [InlineData("path")]
    [InlineData("query")]
    [InlineData("fragment")]
    [InlineData("userinfo")]
    [InlineData("credentials")]
    [InlineData("anonymous")]
    public async Task InvalidConfigurationDoesNotReachTransport(string invalid)
    {
        var configuration = ValidOptions();
        switch (invalid)
        {
            case "tls": configuration.TlsMode = "None"; break;
            case "port": configuration.Port = 0; break;
            case "sender": configuration.Sender = "sender@example.test\r\nBcc: user@example.test"; break;
            case "recipient": configuration.AdministratorRecipients = ["not-an-address"]; break;
            case "http": configuration.DashboardUrl = "http://trusted.example.test/admin/privacy"; break;
            case "path": configuration.DashboardUrl += "/operation-sensitive"; break;
            case "query": configuration.DashboardUrl += "?account=account-sensitive"; break;
            case "fragment": configuration.DashboardUrl += "#account-sensitive"; break;
            case "userinfo": configuration.DashboardUrl = "https://user@trusted.example.test/admin/privacy"; break;
            case "credentials": configuration.Password = null; break;
            case "anonymous": configuration.Password = null; configuration.UserName = null; break;
        }
        var transport = new FakePrivacySmtpTransport();
        var sender = new AdminPrivacyNoticeSender(new NoticeOptionsMonitor(configuration), transport,
            new PrivacyTestClock());
        var result = await sender.SendAsync(TestContext.Current.CancellationToken);
        Assert.False(result.Accepted);
        Assert.Equal("smtp_configuration_invalid", result.ErrorCode);
        Assert.Equal(0, transport.Calls);
    }

    [Fact]
    public async Task TimeoutAndTransportErrorsAreCodesOnly()
    {
        var transport = new FakePrivacySmtpTransport { Cancel = true };
        var sender = new AdminPrivacyNoticeSender(new NoticeOptionsMonitor(ValidOptions()), transport,
            new PrivacyTestClock());
        Assert.Equal("smtp_timeout", (await sender.SendAsync(TestContext.Current.CancellationToken)).ErrorCode);
        transport.Cancel = false;
        transport.Result = new(false, "smtp_rejected");
        Assert.Equal("smtp_rejected", (await sender.SendAsync(TestContext.Current.CancellationToken)).ErrorCode);
    }

    [Fact]
    public async Task MalformedBoundConfigurationIsReportedWithoutStartingSmtpOrFailingHost()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Privacy:Smtp:Port"] = "not-a-port"
        }).Build();
        var transport = new FakePrivacySmtpTransport();
        var services = new ServiceCollection();
        services.AddSingleton<IPrivacySmtpTransport>(transport);
        services.AddPrivacyAdminNotices(configuration);
        await using var provider = services.BuildServiceProvider();
        var result = await provider.GetRequiredService<IAdminPrivacyNoticeSender>()
            .SendAsync(TestContext.Current.CancellationToken);
        Assert.Equal("smtp_configuration_invalid", result.ErrorCode);
        Assert.Equal(0, transport.Calls);
    }

    private static PrivacyNoticeWorker Worker(MemoryErasureJournal journal, IAdminPrivacyNoticeSender sender,
        PrivacyTestClock clock, PrivacyOperationGate? gate = null) =>
        new(journal, gate ?? new PrivacyOperationGate(), sender, clock, NullLogger<PrivacyNoticeWorker>.Instance);

    private static MemoryErasureJournal PendingJournal()
    {
        var journal = new MemoryErasureJournal();
        var operation = new ErasureOperation("operation-sensitive",
            new AccountReference("account-sensitive", "subject-sensitive"), "awaiting_manual_identity_removal")
        {
            NoticeStatus = "queued"
        };
        journal.Operations[operation.Id] = operation;
        return journal;
    }

    private static PrivacySmtpOptions ValidOptions() => new()
    {
        Host = "smtp.example.test", Sender = "notices@example.test",
        AdministratorRecipients = ["administrator@example.test"],
        DashboardUrl = "https://trusted.example.test/admin/privacy",
        UserName = "smtp-account", Password = "runtime-secret"
    };
}
