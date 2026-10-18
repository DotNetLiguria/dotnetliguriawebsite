namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed class PrivacyNoticeWorker(
    IErasureJournal journal,
    PrivacyOperationGate gate,
    IAdminPrivacyNoticeSender sender,
    TimeProvider clock,
    ILogger<PrivacyNoticeWorker> logger) : BackgroundService
{
    public const int MaximumAttempts = 5;
    public string? LastErrorCode { get; private set; }

    public async Task ProcessPendingAsync(CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ErasureOperation> operations;
        using (await gate.EnterAsync(cancellationToken))
            operations = await journal.ListAsync(cancellationToken);
        foreach (var operation in operations)
        {
            ErasureOperation reserved;
            using (await gate.EnterAsync(cancellationToken))
            {
                var current = await journal.FindAsync(operation.Account, cancellationToken);
                if (current is null || current.Id != operation.Id || !IsDue(current, clock.GetUtcNow()))
                    continue;
                var attempts = current.NoticeAttempts + 1;
                reserved = current with
                {
                    NoticeStatus = "failed",
                    NoticeAttempts = attempts,
                    NoticeNextAttemptAt = attempts < MaximumAttempts
                        ? clock.GetUtcNow().AddMinutes(1 << (attempts - 1)) : null,
                    NoticeErrorCode = "smtp_outcome_unknown",
                    NoticeAttemptToken = Guid.NewGuid().ToString("N")
                };
                // A crash after SMTP acceptance can cause a duplicate on recovery; this is not exactly-once delivery.
                await journal.SaveAsync(reserved, cancellationToken);
            }

            var result = await sender.SendAsync(cancellationToken);
            using (await gate.EnterAsync(cancellationToken))
            {
                var current = await journal.FindAsync(reserved.Account, cancellationToken);
                if (current != reserved) continue;
                await journal.SaveAsync(current with
                {
                    NoticeStatus = result.Accepted ? "accepted_by_smtp" : "failed",
                    NoticeNextAttemptAt = result.Accepted ? null : reserved.NoticeNextAttemptAt,
                    NoticeErrorCode = result.Accepted ? null : result.ErrorCode ?? "smtp_transport_failed",
                    NoticeAttemptToken = null
                }, cancellationToken);
            }
        }
        LastErrorCode = null;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try { await ProcessPendingAsync(stoppingToken); }
                catch (PrivacyBlockedException) { ReportFailure("smtp_journal_blocked"); }
                catch (IOException) { ReportFailure("smtp_journal_unavailable"); }
                catch (UnauthorizedAccessException) { ReportFailure("smtp_journal_unavailable"); }
                await Task.Delay(TimeSpan.FromSeconds(15), clock, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    private void ReportFailure(string code)
    {
        LastErrorCode = code;
        logger.LogWarning("Administrative privacy notices unavailable: {ErrorCode}", code);
    }

    private static bool IsDue(ErasureOperation operation, DateTimeOffset now) =>
        operation.Stage is "awaiting_manual_identity_removal" or "identity_verification_blocked" &&
        operation.NoticeStatus is "queued" or "failed" &&
        operation.NoticeAttempts is >= 0 and < MaximumAttempts &&
        (operation.NoticeNextAttemptAt is null || operation.NoticeNextAttemptAt <= now);
}
