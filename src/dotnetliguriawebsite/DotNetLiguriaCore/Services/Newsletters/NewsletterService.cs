using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterService
{
    private static readonly TimeSpan _confirmationLifetime = TimeSpan.FromMinutes(5);
    private readonly INewsletterStore _store;
    private readonly INewsletterEventSource _events;
    private readonly NewsletterTemplateEngine _templates = new();
    private readonly NewsletterRenderer _renderer;
    private readonly INewsletterSmtpTransport _transport;
    private readonly INewsletterRestoreGuard _restoreGuard;
    private readonly PrivacyOperationGate _operationGate;
    private readonly PrivacyCoordinator _privacy;
    private readonly IOptionsMonitor<NewsletterOptions> _options;
    private readonly IWebHostEnvironment _environment;
    private readonly TimeProvider _clock;

    public NewsletterService(INewsletterStore store, INewsletterEventSource events, NewsletterRenderer renderer,
        INewsletterSmtpTransport transport, INewsletterRestoreGuard restoreGuard, PrivacyOperationGate operationGate,
        PrivacyCoordinator privacy, IOptionsMonitor<NewsletterOptions> options,
        IWebHostEnvironment environment, TimeProvider clock)
    {
        _store = store;
        _events = events;
        _renderer = renderer;
        _transport = transport;
        _restoreGuard = restoreGuard;
        _operationGate = operationGate;
        _privacy = privacy;
        _options = options;
        _environment = environment;
        _clock = clock;
    }

    public object Configuration()
    {
        var options = _options.CurrentValue;
        return new
        {
            defaultTestAddress = options.DefaultTestAddress,
            distributionAddress = options.DistributionAddress,
            testEnabled = options.TestEnabled && options.HasSmtpConfiguration,
            testDisabledReason = !options.HasSmtpConfiguration
                ? "Configurazione SMTP incompleta o non valida: " +
                  string.Join(", ", options.SmtpConfigurationProblems()) +
                  ". Gli indirizzi devono essere semplici (es. nome@dominio.it). Nessun invio è stato eseguito."
                : !options.TestEnabled
                    ? "Il server SMTP è configurato, ma gli invii di prova sono disabilitati. Abilita Newsletters:TestEnabled per consentirli."
                    : null,
            productionEnabled = options.IsProductionReady && _restoreGuard.IsGenerationActive(options.ActivationGeneration),
            maxImageBytes = Math.Clamp(options.MaxImageBytes, 1, NewsletterImageProcessor.MaximumInputBytes)
        };
    }

    public async Task<IReadOnlyList<NewsletterApiModel>> ListAsync(CancellationToken cancellationToken)
    {
        var items = await _store.ListNewslettersAsync(cancellationToken);
        EnsureBounded(items.Count, 500);
        return items.Select(MapNewsletter).ToArray();
    }

    public async Task<NewsletterApiModel?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await _store.GetNewsletterAsync(id, cancellationToken);
        return item is null ? null : await MapNewsletterWithAttemptsAsync(item, cancellationToken);
    }

    public async Task<NewsletterApiModel> CreateAsync(NewsletterCreateRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        ValidateKind(request.Kind);
        ValidateTitle(request.Title);
        ValidateSubject(request.Subject);
        if (request.Markdown is null || request.Markdown.Length > 100_000)
            throw new NewsletterServiceException("newsletter_markdown_too_large", 400);
        if (request.Kind == "event" && request.EventId is null)
            throw new NewsletterServiceException("event_required", 400);
        if (request.Kind == "generic" && request.EventId is not null)
            throw new NewsletterServiceException("event_not_allowed", 400);
        var actor = GetActor(principal);
        var item = new NewsletterDocument
        {
            Id = Guid.NewGuid(),
            Kind = request.Kind,
            Title = request.Title.Trim(),
            Subject = request.Subject.Trim(),
            Markdown = request.Markdown,
            TemplateId = request.TemplateId,
            EventId = request.EventId,
            EventSnapshot = request.EventId is { } eventId
                ? await _events.GetEligibleAsync(eventId, cancellationToken) : null,
            CreatedByIssuer = actor.Issuer,
            CreatedBySubject = actor.Subject,
            UpdatedByIssuer = actor.Issuer,
            UpdatedBySubject = actor.Subject,
            UpdatedAt = _clock.GetUtcNow()
        };
        if (item.TemplateId is { } templateId)
        {
            var template = await _store.GetTemplateAsync(templateId, cancellationToken);
            if (template is null || template.Archived || template.Kind != item.Kind)
                throw new NewsletterServiceException("newsletter_template_not_found", 404);
            item.TemplateVersion = template.Version;
        }
        if (!await _store.InsertNewsletterAsync(item, cancellationToken))
            throw new NewsletterServiceException("newsletter_create_conflict", 409);
        return MapNewsletter(item);
    }

    public async Task<NewsletterApiModel> UpdateAsync(Guid id, NewsletterUpdateRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        if (item.Version != request.Version)
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        ValidateTitle(request.Title);
        ValidateSubject(request.Subject);
        if (request.Markdown is null || request.Markdown.Length > 100_000)
            throw new NewsletterServiceException("newsletter_markdown_too_large", 400);
        var actor = GetActor(principal);
        item.Title = request.Title.Trim();
        item.Subject = request.Subject.Trim();
        item.Markdown = request.Markdown;
        item.Version++;
        item.UpdatedAt = _clock.GetUtcNow();
        item.UpdatedByIssuer = actor.Issuer;
        item.UpdatedBySubject = actor.Subject;
        InvalidateApproval(item);
        if (!await _store.ReplaceNewsletterAsync(item, request.Version, cancellationToken))
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        return MapNewsletter(item);
    }

    public async Task<NewsletterApiModel> ArchiveAsync(Guid id, NewsletterVersionRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        if (item.Version != request.Version)
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        var actor = GetActor(principal);
        item.Archived = true;
        item.Version++;
        item.UpdatedAt = _clock.GetUtcNow();
        item.UpdatedByIssuer = actor.Issuer;
        item.UpdatedBySubject = actor.Subject;
        InvalidateApproval(item);
        if (!await _store.ReplaceNewsletterAsync(item, request.Version, cancellationToken))
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        return MapNewsletter(item);
    }

    public async Task<NewsletterApiModel> CloneAsync(Guid id, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var source = await RequireNewsletterAsync(id, cancellationToken);
        var actor = GetActor(principal);
        var clone = new NewsletterDocument
        {
            Id = Guid.NewGuid(),
            Kind = source.Kind,
            Title = source.Title + " (copia)",
            Subject = source.Subject,
            Markdown = source.Markdown,
            TemplateId = source.TemplateId,
            TemplateVersion = source.TemplateVersion,
            EventId = source.EventId,
            EventSnapshot = source.EventSnapshot is null ? null :
                JsonSerializer.Deserialize<NewsletterEventProjection>(JsonSerializer.Serialize(source.EventSnapshot)),
            OriginId = source.Id.ToString("D"),
            CreatedByIssuer = actor.Issuer,
            CreatedBySubject = actor.Subject,
            UpdatedByIssuer = actor.Issuer,
            UpdatedBySubject = actor.Subject,
            UpdatedAt = _clock.GetUtcNow()
        };
        if (!await _store.InsertNewsletterAsync(clone, cancellationToken))
            throw new NewsletterServiceException("newsletter_create_conflict", 409);
        return MapNewsletter(clone);
    }

    public Task<IReadOnlyList<NewsletterEventProjection>> EventsAsync(CancellationToken cancellationToken) =>
        _events.ListEligibleAsync(cancellationToken);

    public async Task<NewsletterApiModel> GenerateAsync(Guid id, NewsletterGenerateRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        EnsureVersion(item, request.Version);
        if (item.Kind == "event" && request.EventId is null && item.EventId is null)
            throw new NewsletterServiceException("event_required", 400);
        if (item.Kind == "generic" && request.EventId is not null)
            throw new NewsletterServiceException("event_not_allowed", 400);
        var template = await _store.GetTemplateAsync(request.TemplateId, cancellationToken);
        if (template is null || template.Archived || template.Kind != item.Kind)
            throw new NewsletterServiceException("newsletter_template_not_found", 404);
        NewsletterEventProjection? projection = null;
        if (item.Kind == "event")
            projection = await _events.GetEligibleAsync(request.EventId ?? item.EventId!.Value, cancellationToken);
        if (projection is not null) EnsureCompleteEvent(projection);
        _templates.Validate(template.Subject, item.Kind == "event");
        _templates.Validate(template.Markdown, item.Kind == "event");
        var subject = item.Kind == "event" ? _templates.RenderSubject(template.Subject, projection!) : template.Subject;
        var markdown = item.Kind == "event" ? _templates.Render(template.Markdown, projection!) : template.Markdown;
        ValidateSubject(subject);
        var actor = GetActor(principal);
        item.Subject = subject;
        item.Markdown = markdown;
        item.TemplateId = template.Id;
        item.TemplateVersion = template.Version;
        item.EventId = projection is null ? null : Guid.Parse(projection.Id);
        item.EventSnapshot = projection;
        item.Version++;
        item.UpdatedAt = _clock.GetUtcNow();
        item.UpdatedByIssuer = actor.Issuer;
        item.UpdatedBySubject = actor.Subject;
        InvalidateApproval(item);
        if (!await _store.ReplaceNewsletterAsync(item, request.Version, cancellationToken))
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        return MapNewsletter(item);
    }

    public async Task<NewsletterPreviewApiModel> PreviewAsync(Guid id, NewsletterVersionRequest request,
        CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureVersion(item, request.Version);
        if (item.EventId is { } eventId)
        {
            var current = await _events.GetEligibleAsync(eventId, cancellationToken);
            EnsureCompleteEvent(current);
            if (SerializeProjection(current) != SerializeProjection(item.EventSnapshot))
                throw new NewsletterServiceException("event_changed_regenerate_required", 409);
        }
        var snapshot = await _renderer.PrepareAsync(item, cancellationToken);
        await _store.AddSnapshotAsync(snapshot, cancellationToken);
        IReadOnlyList<string> warnings = item.EventSnapshot is { StartTime: null }
            ? ["event_start_time_unknown"] : [];
        return Preview(snapshot, warnings);
    }

    public async Task<NewsletterPreviewApiModel> SnapshotAsync(Guid id, Guid snapshotId,
        CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        return Preview(await RequireSnapshotAsync(item, snapshotId, cancellationToken));
    }

    public async Task<NewsletterApiModel> ApproveAsync(Guid id, NewsletterApprovalRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        EnsureVersion(item, request.Version);
        _ = await RequireSnapshotAsync(item, request.SnapshotId, cancellationToken);
        await EnsureCurrentEventAsync(item, cancellationToken);
        var actor = GetActor(principal);
        if (!await _store.SetApprovalAsync(id, request.Version, request.SnapshotId, actor.Issuer, actor.Subject,
                _clock.GetUtcNow(), cancellationToken))
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        return MapNewsletter(await RequireNewsletterAsync(id, cancellationToken));
    }

    public async Task<NewsletterImageApiModel> UploadImageAsync(Guid id, Stream source, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        var max = Math.Clamp(_options.CurrentValue.MaxImageBytes, 1, NewsletterImageProcessor.MaximumInputBytes);
        await using var buffer = new MemoryStream();
        var chunk = new byte[32 * 1024];
        while (true)
        {
            var read = await source.ReadAsync(chunk, cancellationToken);
            if (read == 0) break;
            if (buffer.Length + read > max)
                throw new NewsletterServiceException("image_size_exceeded", 400);
            await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
        }
        var normalized = NewsletterImageProcessor.Normalize(buffer.ToArray());
        var actor = GetActor(principal);
        var image = new NewsletterImageDocument
        {
            Id = Guid.NewGuid(),
            Data = normalized.Data,
            ContentType = normalized.ContentType,
            Digest = Convert.ToHexString(SHA256.HashData(normalized.Data)),
            Width = normalized.Width,
            Height = normalized.Height,
            CreatedAt = _clock.GetUtcNow(),
            OwnerIssuer = actor.Issuer,
            OwnerSubject = actor.Subject
        };
        await _store.AddImageAsync(image, cancellationToken);
        return new NewsletterImageApiModel(image.Id.ToString("D"),
            $"![image](newsletter-image:{image.Id:D})");
    }

    public async Task<NewsletterAttemptApiModel> TestAsync(Guid id, NewsletterTestSendRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var options = CopyOptions(_options.CurrentValue);
        if (!options.TestEnabled || !options.HasSmtpConfiguration)
            throw new NewsletterServiceException("newsletter_test_sending_disabled", 503);
        ValidateTestRecipient(request.Recipient, options);
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        EnsureVersion(item, request.Version);
        EnsureApproved(item, request.SnapshotId);
        var snapshot = await RequireSnapshotAsync(item, request.SnapshotId, cancellationToken);
        var actor = GetActor(principal);
        var attemptId = Guid.NewGuid();
        var messageId = CreateMessageId(attemptId, options.SenderAddress);
        var attempt = new NewsletterAttemptDocument
        {
            Id = attemptId,
            NewsletterId = id,
            SnapshotId = request.SnapshotId,
            ContentHash = snapshot.ContentHash,
            Mode = "test",
            Recipient = request.Recipient.Trim(),
            Status = "unknown",
            MessageId = messageId,
            ActorIssuer = actor.Issuer,
            ActorSubject = actor.Subject,
            SubmissionTimeoutSeconds = Math.Clamp(options.SmtpTimeoutSeconds, 5, 120),
            OccurredAt = _clock.GetUtcNow()
        };
        using (await _operationGate.EnterAsync(cancellationToken))
        {
            await _privacy.EnsureAccountActiveAsync(actor, cancellationToken);
            item = await RequireNewsletterAsync(id, cancellationToken);
            EnsureEditable(item);
            EnsureVersion(item, request.Version);
            EnsureApproved(item, request.SnapshotId);
            _ = await RequireSnapshotAsync(item, request.SnapshotId, cancellationToken);
            await _store.AddAttemptAsync(attempt, cancellationToken);
        }
        var result = await DeliverAsync(snapshot, options, request.Recipient.Trim(), true, messageId, CancellationToken.None);
        attempt.Status = result.Status;
        attempt.ErrorCode = result.ErrorCode;
        if (!await _store.UpdateAttemptAsync(attempt, "unknown", CancellationToken.None))
            throw new NewsletterServiceException("newsletter_attempt_update_failed", 503);
        if (result.Status == "accepted")
            await _store.SetTestApprovalAsync(id, request.Version, request.SnapshotId, CancellationToken.None);
        return MapAttempt(attempt);
    }

    public async Task<NewsletterConfirmationApiModel> ConfirmAsync(Guid id, NewsletterConfirmationRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (!request.VisualApproved)
            throw new NewsletterServiceException("visual_approval_required", 400);
        var options = _options.CurrentValue;
        EnsureProductionEnabled(options);
        var item = await RequireNewsletterAsync(id, cancellationToken);
        EnsureEditable(item);
        EnsureVersion(item, request.Version);
        EnsureApproved(item, request.SnapshotId);
        var snapshot = await RequireSnapshotAsync(item, request.SnapshotId, cancellationToken);
        await EnsureCurrentEventAsync(item, cancellationToken);
        if (item.TestSnapshotId != request.SnapshotId.ToString() ||
            !await HasAcceptedTestAsync(id, request.SnapshotId, snapshot.ContentHash, cancellationToken))
            throw new NewsletterServiceException("successful_test_required", 409);
        if (snapshot.ConfigurationFingerprint != _renderer.ConfigurationFingerprint())
            throw new NewsletterServiceException("newsletter_snapshot_stale", 409);
        if (!_restoreGuard.IsGenerationActive(options.ActivationGeneration))
            throw new NewsletterServiceException("newsletter_production_suspended", 409);
        var actor = GetActor(principal);
        var confirmation = new NewsletterConfirmationDocument
        {
            Id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
            NewsletterId = id,
            NewsletterVersion = item.Version,
            SnapshotId = snapshot.Id,
            ContentHash = snapshot.ContentHash,
            ConfigurationFingerprint = snapshot.ConfigurationFingerprint,
            DistributionAddress = options.DistributionAddress,
            Operator = ActorKey(actor),
            ExpiresAt = _clock.GetUtcNow().Add(_confirmationLifetime)
        };
        await _store.AddConfirmationAsync(confirmation, cancellationToken);
        return new NewsletterConfirmationApiModel(confirmation.Id, confirmation.ExpiresAt,
            confirmation.DistributionAddress);
    }

    public async Task<NewsletterAttemptApiModel> SendAsync(Guid id, NewsletterProductionSendRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ConfirmationId))
            throw new NewsletterServiceException("newsletter_confirmation_invalid", 400);
        var options = CopyOptions(_options.CurrentValue);
        EnsureProductionEnabled(options);
        var actor = GetActor(principal);
        var attemptId = Guid.NewGuid();
        NewsletterDocument item;
        NewsletterSnapshotDocument snapshot;
        NewsletterConfirmationDocument confirmation;
        var messageId = CreateMessageId(attemptId, options.SenderAddress);

        using (await _operationGate.EnterAsync(cancellationToken))
        {
            await _privacy.EnsureAccountActiveAsync(actor, cancellationToken);
            item = await RequireNewsletterAsync(id, cancellationToken);
            EnsureEditable(item);
            EnsureVersion(item, request.Version);
            EnsureApproved(item, request.SnapshotId);
            snapshot = await RequireSnapshotAsync(item, request.SnapshotId, cancellationToken);
            confirmation = await _store.GetConfirmationAsync(request.ConfirmationId, cancellationToken)
                ?? throw new NewsletterServiceException("newsletter_confirmation_invalid", 409);
            if (confirmation.NewsletterId != id || confirmation.NewsletterVersion != item.Version ||
                confirmation.SnapshotId != snapshot.Id || confirmation.ContentHash != snapshot.ContentHash ||
                confirmation.ConfigurationFingerprint != _renderer.ConfigurationFingerprint() ||
                !string.Equals(confirmation.DistributionAddress, options.DistributionAddress, StringComparison.OrdinalIgnoreCase) ||
                confirmation.Operator != ActorKey(actor) || confirmation.ExpiresAt <= _clock.GetUtcNow() || confirmation.Consumed)
                throw new NewsletterServiceException("newsletter_confirmation_invalid", 409);
            await EnsureCurrentEventAsync(item, cancellationToken);
            if (item.TestSnapshotId != request.SnapshotId.ToString() ||
                !await HasAcceptedTestAsync(id, request.SnapshotId, snapshot.ContentHash, cancellationToken))
                throw new NewsletterServiceException("successful_test_required", 409);
            if (snapshot.ConfigurationFingerprint != _renderer.ConfigurationFingerprint() ||
                !_restoreGuard.IsGenerationActive(options.ActivationGeneration))
                throw new NewsletterServiceException("newsletter_production_suspended", 409);
            var startedAt = _clock.GetUtcNow();
            if (!await _store.TryClaimProductionAsync(id, request.Version, snapshot.Id, attemptId,
                    confirmation.Id, options.ActivationGeneration, messageId, options.DistributionAddress,
                    actor.Issuer, actor.Subject, startedAt, cancellationToken))
                throw new NewsletterServiceException("newsletter_confirmation_consumed_or_stale", 409);
            if (!await _store.ConsumeConfirmationAsync(confirmation.Id, CancellationToken.None))
                throw new NewsletterServiceException("newsletter_confirmation_consumed_or_stale", 409);
            var attempt = new NewsletterAttemptDocument
            {
                Id = attemptId,
                NewsletterId = id,
                SnapshotId = snapshot.Id,
                ContentHash = snapshot.ContentHash,
                Mode = "production",
                Recipient = options.DistributionAddress,
                Status = "unknown",
                MessageId = messageId,
                ActorIssuer = actor.Issuer,
                ActorSubject = actor.Subject,
                SubmissionTimeoutSeconds = Math.Clamp(options.SmtpTimeoutSeconds, 5, 120),
                OccurredAt = startedAt
            };
            await _store.AddAttemptAsync(attempt, CancellationToken.None);
        }

        var result = await DeliverAsync(snapshot, options, options.DistributionAddress, false, messageId,
            CancellationToken.None);
        var finalAttempt = await _store.GetAttemptAsync(attemptId, CancellationToken.None)
            ?? throw new NewsletterServiceException("newsletter_attempt_missing", 503);
        finalAttempt.Status = result.Status;
        finalAttempt.ErrorCode = result.ErrorCode;
        if (!await _store.UpdateAttemptAsync(finalAttempt, "unknown", CancellationToken.None))
            throw new NewsletterServiceException("newsletter_attempt_update_failed", 503);
        if (!await _store.CompleteProductionAsync(id, attemptId, result.Status, CancellationToken.None))
            throw new NewsletterServiceException("newsletter_attempt_changed", 409);
        return MapAttempt(finalAttempt);
    }

    public async Task<byte[]> EmlAsync(Guid id, Guid snapshotId, string recipient,
        CancellationToken cancellationToken)
    {
        var item = await RequireNewsletterAsync(id, cancellationToken);
        var snapshot = await RequireSnapshotAsync(item, snapshotId, cancellationToken);
        ValidateTestRecipient(recipient, _options.CurrentValue);
        var options = CopyOptions(_options.CurrentValue);
        if (!NewsletterOptions.IsMailbox(options.SenderAddress))
            options.SenderAddress = "newsletter@example.invalid";
        using var message = NewsletterRenderer.BuildMessage(snapshot, options, recipient, true, null);
        await using var output = new MemoryStream();
        await message.WriteToAsync(output, cancellationToken);
        if (output.Length > options.MaxMimeBytes)
            throw new NewsletterServiceException("newsletter_mime_too_large", 400);
        return output.ToArray();
    }

    public async Task<IReadOnlyList<NewsletterAttemptApiModel>> HistoryAsync(Guid id, CancellationToken cancellationToken)
    {
        var newsletter = await RequireNewsletterAsync(id, cancellationToken);
        var attempts = (await _store.GetAttemptsAsync(id, cancellationToken)).ToList();
        if (newsletter.ProductionAttemptId is { } attemptId && attempts.All(attempt => attempt.Id != attemptId) &&
            newsletter.LastProductionSnapshotId is { } snapshotId)
            attempts.Add(await RecoverProductionAttemptAsync(newsletter, attemptId, snapshotId, cancellationToken));
        EnsureBounded(attempts.Count, 200);
        return attempts.OrderByDescending(attempt => attempt.OccurredAt)
            .Select(attempt => MapAttempt(attempt, newsletter)).ToArray();
    }

    public async Task<NewsletterApiModel> ReconcileAsync(Guid id, NewsletterReconcileRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (request.Outcome is not ("accepted" or "not-submitted") ||
            string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length is < 10 or > 1000)
            throw new NewsletterServiceException("invalid_reconciliation", 400);
        using var lease = await _operationGate.EnterAsync(cancellationToken);
        var actor = GetActor(principal);
        await _privacy.EnsureAccountActiveAsync(actor, cancellationToken);
        var item = await RequireNewsletterAsync(id, cancellationToken);
        var attempt = await _store.GetAttemptAsync(request.AttemptId, cancellationToken);
        if (attempt is null && item.ProductionAttemptId == request.AttemptId &&
            item.LastProductionSnapshotId is { } snapshotId)
        {
            attempt = await RecoverProductionAttemptAsync(item, request.AttemptId, snapshotId, cancellationToken);
            try
            {
                await _store.AddAttemptAsync(attempt, cancellationToken);
            }
            catch (MongoDB.Driver.MongoWriteException)
            {
                attempt = await _store.GetAttemptAsync(request.AttemptId, cancellationToken) ?? attempt;
            }
        }
        if (attempt is null || attempt.NewsletterId != id || attempt.Mode is not ("production" or "test"))
            throw new NewsletterServiceException("newsletter_attempt_not_reconcilable", 409);
        var pendingClaim = attempt.Mode == "production" && item.ProductionAttemptId == attempt.Id &&
            item.ProductionStatus is "submitting" or "unknown";
        if (attempt.Mode == "production" && !pendingClaim ||
            attempt.Status != "unknown" && (!pendingClaim || attempt.Status != request.Outcome))
            throw new NewsletterServiceException("newsletter_attempt_not_reconcilable", 409);
        if (attempt.Status == "unknown")
        {
            if (attempt.ReconciledAt is not null)
                throw new NewsletterServiceException("newsletter_attempt_not_reconcilable", 409);
            // A bounded SMTP call may still be unwinding after its cancellation deadline.
            var settleAfter = attempt.OccurredAt.AddSeconds(
                Math.Max(Math.Clamp(_options.CurrentValue.SmtpTimeoutSeconds, 5, 120),
                    attempt.SubmissionTimeoutSeconds)).AddMinutes(2);
            if (_clock.GetUtcNow() < settleAfter)
                throw new NewsletterServiceException("newsletter_attempt_still_settling", 409);
        }
        var oldStatus = attempt.Status;
        if (attempt.ReconciledAt is null)
        {
            attempt.Status = request.Outcome;
            attempt.ReconciliationReason = request.Reason.Trim();
            attempt.ReconciledByIssuer = actor.Issuer;
            attempt.ReconciledBySubject = actor.Subject;
            attempt.ReconciledAt = _clock.GetUtcNow();
            if (!await _store.UpdateAttemptAsync(attempt, oldStatus, cancellationToken))
                throw new NewsletterServiceException("newsletter_attempt_changed", 409);
        }
        if (attempt.Mode == "production")
        {
            if (!await _store.CompleteProductionAsync(id, attempt.Id, request.Outcome, CancellationToken.None))
                throw new NewsletterServiceException("newsletter_attempt_changed", 409);
        }
        item = await RequireNewsletterAsync(id, CancellationToken.None);
        return await MapNewsletterWithAttemptsAsync(item, CancellationToken.None);
    }

    public async Task<IReadOnlyList<NewsletterTemplateApiModel>> ListTemplatesAsync(CancellationToken cancellationToken)
    {
        await EnsureSeededAsync(cancellationToken);
        var items = await _store.ListTemplatesAsync(cancellationToken);
        EnsureBounded(items.Count, 500);
        return items.Select(MapTemplate).ToArray();
    }

    public async Task<NewsletterTemplateApiModel?> GetTemplateAsync(Guid id, CancellationToken cancellationToken)
    {
        var template = await _store.GetTemplateAsync(id, cancellationToken);
        return template is null ? null : MapTemplate(template);
    }

    public async Task<NewsletterTemplateApiModel> CreateTemplateAsync(NewsletterTemplateCreateRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        ValidateKind(request.Kind);
        ValidateTitle(request.Name);
        _templates.ValidateSubject(request.Subject, request.Kind == "event");
        _templates.Validate(request.Markdown, request.Kind == "event");
        var actor = GetActor(principal);
        var now = _clock.GetUtcNow();
        var template = new NewsletterTemplateDocument
        {
            Id = Guid.NewGuid(), Kind = request.Kind, Name = request.Name.Trim(),
            Subject = request.Subject.Trim(), Markdown = request.Markdown, UpdatedAt = now,
            CreatedByIssuer = actor.Issuer, CreatedBySubject = actor.Subject,
            UpdatedByIssuer = actor.Issuer, UpdatedBySubject = actor.Subject
        };
        var revision = ToRevision(template, actor, now);
        if (!await _store.InsertTemplateAsync(template, cancellationToken))
            throw new NewsletterServiceException("newsletter_template_create_conflict", 409);
        await _store.AddTemplateRevisionAsync(revision, cancellationToken);
        return MapTemplate(template);
    }

    public async Task<NewsletterTemplateApiModel> UpdateTemplateAsync(Guid id,
        NewsletterTemplateUpdateRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await _store.GetTemplateAsync(id, cancellationToken)
            ?? throw new NewsletterServiceException("newsletter_template_not_found", 404);
        if (item.Archived)
            throw new NewsletterServiceException("newsletter_template_archived", 409);
        EnsureVersion(item.Version, request.Version);
        ValidateTitle(request.Name);
        _templates.ValidateSubject(request.Subject, item.Kind == "event");
        _templates.Validate(request.Markdown, item.Kind == "event");
        var actor = GetActor(principal);
        item.Name = request.Name.Trim();
        item.Subject = request.Subject.Trim();
        item.Markdown = request.Markdown;
        item.Version++;
        item.UpdatedAt = _clock.GetUtcNow();
        item.UpdatedByIssuer = actor.Issuer;
        item.UpdatedBySubject = actor.Subject;
        if (!await _store.ReplaceTemplateAsync(item, request.Version, cancellationToken))
            throw new NewsletterServiceException("newsletter_template_version_conflict", 409);
        await _store.AddTemplateRevisionAsync(ToRevision(item, actor, item.UpdatedAt), cancellationToken);
        return MapTemplate(item);
    }

    public async Task<NewsletterTemplateApiModel> ArchiveTemplateAsync(Guid id,
        NewsletterVersionRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var item = await _store.GetTemplateAsync(id, cancellationToken)
            ?? throw new NewsletterServiceException("newsletter_template_not_found", 404);
        EnsureVersion(item.Version, request.Version);
        var actor = GetActor(principal);
        item.Archived = true;
        item.Version++;
        item.UpdatedAt = _clock.GetUtcNow();
        item.UpdatedByIssuer = actor.Issuer;
        item.UpdatedBySubject = actor.Subject;
        if (!await _store.ReplaceTemplateAsync(item, request.Version, cancellationToken))
            throw new NewsletterServiceException("newsletter_template_version_conflict", 409);
        await _store.AddTemplateRevisionAsync(ToRevision(item, actor, item.UpdatedAt), cancellationToken);
        return MapTemplate(item);
    }

    public async Task<NewsletterTemplatePreviewApiModel> PreviewTemplateAsync(Guid id,
        NewsletterTemplatePreviewRequest request, CancellationToken cancellationToken)
    {
        var template = await _store.GetTemplateAsync(id, cancellationToken)
            ?? throw new NewsletterServiceException("newsletter_template_not_found", 404);
        EnsureVersion(template.Version, request.Version);
        NewsletterEventProjection? projection = null;
        if (template.Kind == "event")
        {
            if (request.EventId is null)
                throw new NewsletterServiceException("event_required", 400);
            projection = await _events.GetEligibleAsync(request.EventId.Value, cancellationToken);
            EnsureCompleteEvent(projection);
        }
        _templates.Validate(template.Subject, template.Kind == "event");
        _templates.Validate(template.Markdown, template.Kind == "event");
        var subject = projection is null ? template.Subject : _templates.RenderSubject(template.Subject, projection);
        var markdown = projection is null ? template.Markdown : _templates.Render(template.Markdown, projection);
        var sample = new NewsletterDocument
        {
            Id = Guid.NewGuid(),
            Kind = template.Kind,
            Subject = subject,
            Markdown = markdown,
            Version = template.Version,
            EventId = projection is null ? null : Guid.Parse(projection.Id),
            EventSnapshot = projection
        };
        var snapshot = await _renderer.PrepareAsync(sample, cancellationToken);
        return new NewsletterTemplatePreviewApiModel(subject, markdown, snapshot.Html, snapshot.PlainText,
            snapshot.Images.Select(image => new NewsletterPreviewImageApiModel(image.Cid,
                image.ContentType, Convert.ToBase64String(image.Data))).ToArray(),
            projection is { StartTime: null } ? ["event_start_time_unknown"] : []);
    }

    public IReadOnlyList<string> Placeholders() => _templates.Placeholders;

    public async Task EnsureSeededAsync(CancellationToken cancellationToken)
    {
        var directory = Path.Combine(_environment.ContentRootPath, "Contents", "newsletters");
        await SeedAsync(Guid.Parse("3c44fd9c-a82f-4e1c-89c8-faa000000001"), "event", "Template evento",
            "event-subject.md", "event-body.md", directory, cancellationToken);
        await SeedAsync(Guid.Parse("3c44fd9c-a82f-4e1c-89c8-faa000000002"), "generic", "Template generico",
            "generic-subject.md", "generic-body.md", directory, cancellationToken);
    }

    private async Task SeedAsync(Guid id, string kind, string name, string subjectFile, string markdownFile,
        string directory, CancellationToken cancellationToken)
    {
        var subjectPath = Path.Combine(directory, subjectFile);
        var markdownPath = Path.Combine(directory, markdownFile);
        if (!File.Exists(subjectPath) || !File.Exists(markdownPath))
            throw new NewsletterServiceException("newsletter_seed_template_missing", 503);
        var now = _clock.GetUtcNow();
        var template = new NewsletterTemplateDocument
        {
            Id = id, Kind = kind, Name = name,
            Subject = (await File.ReadAllTextAsync(subjectPath, cancellationToken)).Trim(),
            Markdown = await File.ReadAllTextAsync(markdownPath, cancellationToken),
            UpdatedAt = now
        };
        _templates.ValidateSubject(template.Subject, kind == "event");
        _templates.Validate(template.Markdown, kind == "event");
        await _store.SeedTemplateAsync(template, ToRevision(template, null, now), cancellationToken);
    }

    private async Task<NewsletterDocument> RequireNewsletterAsync(Guid id, CancellationToken cancellationToken) =>
        await _store.GetNewsletterAsync(id, cancellationToken)
        ?? throw new NewsletterServiceException("newsletter_not_found", 404);

    private async Task<NewsletterSnapshotDocument> RequireSnapshotAsync(NewsletterDocument item, Guid snapshotId,
        CancellationToken cancellationToken)
    {
        var snapshot = await _store.GetSnapshotAsync(snapshotId, cancellationToken)
            ?? throw new NewsletterServiceException("newsletter_snapshot_not_found", 404);
        if (snapshot.NewsletterId != item.Id || snapshot.NewsletterVersion != item.Version ||
            snapshot.ConfigurationFingerprint != _renderer.ConfigurationFingerprint())
            throw new NewsletterServiceException("newsletter_snapshot_stale", 409);
        return snapshot;
    }

    private async Task<NewsletterAttemptDocument> RecoverProductionAttemptAsync(NewsletterDocument item,
        Guid attemptId, Guid snapshotId, CancellationToken cancellationToken)
    {
        var snapshot = await _store.GetSnapshotAsync(snapshotId, cancellationToken);
        return new NewsletterAttemptDocument
        {
            Id = attemptId,
            NewsletterId = item.Id,
            SnapshotId = snapshotId,
            ContentHash = snapshot?.ContentHash ?? "",
            Mode = "production",
            Recipient = item.ProductionRecipient,
            Status = "unknown",
            MessageId = item.ProductionMessageId,
            ActorIssuer = item.ProductionActorIssuer,
            ActorSubject = item.ProductionActorSubject,
            OccurredAt = item.ProductionStartedAt ?? item.UpdatedAt
        };
    }

    private async Task<bool> HasAcceptedTestAsync(Guid newsletterId, Guid snapshotId, string contentHash,
        CancellationToken cancellationToken)
    {
        var attempts = await _store.GetAttemptsAsync(newsletterId, cancellationToken);
        EnsureBounded(attempts.Count, 200);
        return attempts.Any(attempt =>
            attempt.Mode == "test" && attempt.SnapshotId == snapshotId &&
            attempt.ContentHash == contentHash && attempt.Status == "accepted");
    }

    private async Task EnsureCurrentEventAsync(NewsletterDocument item, CancellationToken cancellationToken)
    {
        if (item.EventId is not { } id) return;
        var current = await _events.GetEligibleAsync(id, cancellationToken);
        EnsureCompleteEvent(current);
        if (SerializeProjection(current) != SerializeProjection(item.EventSnapshot))
            throw new NewsletterServiceException("event_changed_regenerate_required", 409);
    }

    private async Task<NewsletterTransportResult> DeliverAsync(NewsletterSnapshotDocument snapshot,
        NewsletterOptions options, string recipient, bool test, string messageId,
        CancellationToken cancellationToken)
    {
        using var message = NewsletterRenderer.BuildMessage(snapshot, options, recipient, test, messageId);
        if (await NewsletterRenderer.GetMessageBytesAsync(message, cancellationToken) >
            Math.Clamp(options.MaxMimeBytes, 65_536, 10 * 1024 * 1024))
            return new NewsletterTransportResult("not-submitted", "newsletter_mime_too_large");
        cancellationToken.ThrowIfCancellationRequested();
        using var timeout = new CancellationTokenSource(
            TimeSpan.FromSeconds(Math.Clamp(options.SmtpTimeoutSeconds, 5, 120)), _clock);
        try
        {
            var result = await _transport.SendAsync(message, recipient, options, timeout.Token).WaitAsync(timeout.Token);
            return result.Status is "accepted" or "not-submitted" or "unknown"
                ? result : new NewsletterTransportResult("unknown", "smtp_result_unknown");
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return new NewsletterTransportResult("unknown", "smtp_result_unknown");
        }
    }

    private static NewsletterPreviewApiModel Preview(NewsletterSnapshotDocument snapshot,
        IReadOnlyList<string>? warnings = null) =>
        new(snapshot.Id.ToString("D"), snapshot.ContentHash, snapshot.Subject, snapshot.Html,
            snapshot.PlainText, snapshot.Images.Select(image => new NewsletterPreviewImageApiModel(image.Cid,
                image.ContentType, Convert.ToBase64String(image.Data))).ToArray(),
            snapshot.MessageBytes,
            warnings ?? []);

    private async Task<NewsletterApiModel> MapNewsletterWithAttemptsAsync(NewsletterDocument item,
        CancellationToken cancellationToken)
    {
        var attempts = await _store.GetAttemptsAsync(item.Id, cancellationToken);
        EnsureBounded(attempts.Count, 200);
        return MapNewsletter(item) with
        {
            Attempts = attempts.Select(attempt => MapAttempt(attempt, item)).ToArray()
        };
    }

    private static void EnsureBounded(int count, int maximum)
    {
        if (count > maximum)
            throw new NewsletterServiceException("newsletter_collection_limit_exceeded", 409);
    }

    private static void EnsureCompleteEvent(NewsletterEventProjection projection)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(projection.StartTime)) missing.Add("orario di inizio");
        if (string.IsNullOrWhiteSpace(projection.EndTime)) missing.Add("orario di fine");
        if (projection.Talks.Count == 0) missing.Add("interventi");
        if (string.IsNullOrWhiteSpace(projection.LocationName)) missing.Add("nome della sede");
        if (string.IsNullOrWhiteSpace(projection.LocationAddress)) missing.Add("indirizzo della sede");
        if (string.IsNullOrWhiteSpace(projection.MapUrl)) missing.Add("link alla mappa");
        if (string.IsNullOrWhiteSpace(projection.Url)) missing.Add("URL pubblico (configurazione Newsletters:PublicBaseUrl)");
        if (missing.Count > 0)
            throw new NewsletterServiceException("event_public_details_incomplete", 409,
                $"Impossibile generare la newsletter: mancano {string.Join(", ", missing)}. " +
                "Completa i dati dell’evento e la configurazione indicata, poi riprova. Il testo nell’editor non è stato modificato.");
    }

    private static NewsletterApiModel MapNewsletter(NewsletterDocument item) =>
        new(item.Id.ToString("D"), item.Kind, item.Title, item.Subject, item.Markdown,
            item.Version, item.TemplateId, item.TemplateVersion, item.EventId, item.Archived,
            item.ProductionStatus, item.UpdatedAt, null, item.ApprovedSnapshotId, item.ApprovedAt,
            item.TestSnapshotId is not null && item.TestSnapshotId == item.ApprovedSnapshotId ? item.TestSnapshotId : null);

    private static void EnsureApproved(NewsletterDocument item, Guid snapshotId)
    {
        if (item.ApprovedSnapshotId != snapshotId.ToString())
            throw new NewsletterServiceException("newsletter_approval_required", 409);
    }

    private static NewsletterTemplateApiModel MapTemplate(NewsletterTemplateDocument item) =>
        new(item.Id.ToString("D"), item.Kind, item.Name, item.Subject, item.Markdown, item.Version, item.Archived);

    private static NewsletterAttemptApiModel MapAttempt(NewsletterAttemptDocument attempt,
        NewsletterDocument? newsletter = null)
    {
        var pendingClaim = attempt.Mode == "production" &&
            newsletter is { ProductionStatus: "submitting" or "unknown" } &&
            newsletter.ProductionAttemptId == attempt.Id;
        var knownOutcome = attempt.Status is "accepted" or "not-submitted";
        return new(attempt.Id.ToString("D"), attempt.Mode, attempt.Recipient, attempt.Status,
            attempt.OccurredAt, attempt.ErrorCode, attempt.MessageId,
            attempt.Status == "unknown" && attempt.ReconciledAt is null || pendingClaim && knownOutcome,
            pendingClaim && knownOutcome ? attempt.Status : null);
    }

    private static NewsletterTemplateRevisionDocument ToRevision(NewsletterTemplateDocument template,
        AccountReference? actor, DateTimeOffset now) =>
        new()
        {
            TemplateId = template.Id,
            Version = template.Version,
            Kind = template.Kind,
            Name = template.Name,
            Subject = template.Subject,
            Markdown = template.Markdown,
            CreatedAt = now,
            CreatedByIssuer = actor?.Issuer,
            CreatedBySubject = actor?.Subject
        };

    private static void InvalidateApproval(NewsletterDocument item)
    {
        item.ApprovedSnapshotId = null;
        item.ApprovedAt = null;
        item.ApprovedByIssuer = null;
        item.ApprovedBySubject = null;
        item.TestSnapshotId = null;
        item.VisualApproved = false;
        item.ConfirmationId = null;
        item.ConfirmationExpiresAt = null;
        item.ConfirmationOperator = null;
        item.ConfirmationConsumed = false;
    }

    private static AccountReference GetActor(ClaimsPrincipal principal)
    {
        var issuer = principal.FindFirst("iss")?.Value;
        var subject = principal.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(subject))
            throw new NewsletterServiceException("active_account_required", 403);
        return new AccountReference(issuer, subject);
    }

    private static string ActorKey(AccountReference actor) => $"{actor.Issuer}|{actor.Subject}";

    private static string CreateMessageId(Guid attemptId, string sender)
    {
        var domain = sender.Split('@').LastOrDefault();
        if (string.IsNullOrWhiteSpace(domain) || domain.Contains('\r') || domain.Contains('\n'))
            domain = "newsletter.invalid";
        return $"{attemptId:N}@{domain}";
    }

    private static void ValidateTestRecipient(string recipient, NewsletterOptions options)
    {
        if (!NewsletterOptions.IsMailbox(recipient))
            throw new NewsletterServiceException("invalid_test_recipient", 400);
        var address = recipient.Trim();
        if (!options.IsTestAddressAllowed(address))
            throw new NewsletterServiceException("production_recipient_not_allowed_for_test", 400);
    }

    private static void EnsureProductionEnabled(NewsletterOptions options)
    {
        if (!options.IsProductionReady || !NewsletterOptions.IsMailbox(options.DistributionAddress))
            throw new NewsletterServiceException("newsletter_production_disabled", 503);
    }

    private static void EnsureEditable(NewsletterDocument item)
    {
        if (item.Archived)
            throw new NewsletterServiceException("newsletter_archived", 409);
        if (item.ProductionStatus != "draft")
            throw new NewsletterServiceException("newsletter_frozen_clone_to_reuse", 409);
    }

    private static void EnsureVersion(NewsletterDocument item, int version)
    {
        if (item.Version != version)
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
    }

    private static void EnsureVersion(int actual, int expected)
    {
        if (actual != expected)
            throw new NewsletterServiceException("newsletter_template_version_conflict", 409);
    }

    private static void ValidateKind(string kind)
    {
        if (kind is not ("event" or "generic"))
            throw new NewsletterServiceException("invalid_newsletter_kind", 400);
    }

    private static void ValidateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 160 ||
            title.Contains('\r') || title.Contains('\n'))
            throw new NewsletterServiceException("invalid_newsletter_title", 400);
    }

    private static void ValidateSubject(string subject)
    {
        if (string.IsNullOrWhiteSpace(subject) || subject.Length > 200 ||
            subject.Contains('\r') || subject.Contains('\n'))
            throw new NewsletterServiceException("invalid_newsletter_subject", 400);
    }

    private static string SerializeProjection(NewsletterEventProjection? projection) =>
        JsonSerializer.Serialize(projection);

    private static NewsletterOptions CopyOptions(NewsletterOptions source) =>
        new()
        {
            DefaultTestAddress = source.DefaultTestAddress,
            DistributionAddress = source.DistributionAddress,
            DistributionAliases = source.DistributionAliases,
            TestEnabled = source.TestEnabled,
            ProductionEnabled = source.ProductionEnabled,
            ActivationGeneration = source.ActivationGeneration,
            OperationalFolder = source.OperationalFolder,
            PublicBaseUrl = source.PublicBaseUrl,
            SenderAddress = source.SenderAddress,
            SenderName = source.SenderName,
            ReplyToAddress = source.ReplyToAddress,
            SmtpHost = source.SmtpHost,
            SmtpPort = source.SmtpPort,
            SmtpUseStartTls = source.SmtpUseStartTls,
            SmtpUserName = source.SmtpUserName,
            SmtpPassword = source.SmtpPassword,
            SmtpTimeoutSeconds = source.SmtpTimeoutSeconds,
            MaxImageBytes = source.MaxImageBytes,
            MaxMimeBytes = source.MaxMimeBytes,
            MaxImages = source.MaxImages
        };
}
