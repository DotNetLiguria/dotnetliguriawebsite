using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed class PrivacySmtpHealthCheck(
    IOptionsMonitor<PrivacySmtpOptions> options,
    IErasureJournal journal,
    PrivacyOperationGate gate,
    PrivacyNoticeWorker worker) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var error = options.CurrentValue.ConfigurationErrorCode() ?? worker.LastErrorCode;
        if (error is not null) return HealthCheckResult.Degraded(error);
        try
        {
            using (await gate.EnterAsync(cancellationToken))
            {
                var operations = await journal.ListAsync(cancellationToken);
                if (operations.Any(operation => operation.NoticeStatus == "failed"))
                    return HealthCheckResult.Degraded("smtp_pending_notice_failed");
            }
        }
        catch (PrivacyBlockedException) { return HealthCheckResult.Degraded("smtp_journal_blocked"); }
        catch (IOException) { return HealthCheckResult.Degraded("smtp_journal_unavailable"); }
        catch (UnauthorizedAccessException) { return HealthCheckResult.Degraded("smtp_journal_unavailable"); }
        return HealthCheckResult.Healthy("smtp_configured_acceptance_not_delivery");
    }
}
