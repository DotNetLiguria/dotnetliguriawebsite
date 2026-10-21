using DotNetLiguriaCore.Model;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("DotNetLiguriaCore.Tests")]

namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class MongoNewsletterStore : INewsletterStore
{
    public const string NewslettersCollectionName = "Newsletters";
    public const string TemplatesCollectionName = "NewsletterTemplates";
    public const string RevisionsCollectionName = "NewsletterTemplateRevisions";
    public const string ImagesCollectionName = "NewsletterImages";
    public const string SnapshotsCollectionName = "NewsletterSnapshots";
    public const string AttemptsCollectionName = "NewsletterAttempts";
    public const string ConfirmationsCollectionName = "NewsletterConfirmations";

    private readonly IMongoDatabase _database;
    private readonly IMongoCollection<NewsletterDocument> _newsletters;
    private readonly IMongoCollection<NewsletterTemplateDocument> _templates;
    private readonly IMongoCollection<NewsletterTemplateRevisionDocument> _revisions;
    private readonly IMongoCollection<NewsletterImageDocument> _images;
    private readonly IMongoCollection<NewsletterSnapshotDocument> _snapshots;
    private readonly IMongoCollection<NewsletterAttemptDocument> _attempts;
    private readonly IMongoCollection<NewsletterConfirmationDocument> _confirmations;
    private Task? _indexes;

    public MongoNewsletterStore(IOptions<DotNetLiguriaDatabaseSettings> options)
    {
        var settings = options.Value;
        _database = new MongoClient(settings.ConnectionString).GetDatabase(settings.DatabaseName);
        _newsletters = _database.GetCollection<NewsletterDocument>(NewslettersCollectionName);
        _templates = _database.GetCollection<NewsletterTemplateDocument>(TemplatesCollectionName);
        _revisions = _database.GetCollection<NewsletterTemplateRevisionDocument>(RevisionsCollectionName);
        _images = _database.GetCollection<NewsletterImageDocument>(ImagesCollectionName);
        _snapshots = _database.GetCollection<NewsletterSnapshotDocument>(SnapshotsCollectionName);
        _attempts = _database.GetCollection<NewsletterAttemptDocument>(AttemptsCollectionName);
        _confirmations = _database.GetCollection<NewsletterConfirmationDocument>(ConfirmationsCollectionName);
    }

    public async Task<IReadOnlyList<NewsletterDocument>> ListNewslettersAsync(CancellationToken cancellationToken) =>
        await _newsletters.Find(_ => true).SortByDescending(item => item.UpdatedAt)
            .ThenBy(item => item.Id).Limit(501).ToListAsync(cancellationToken);

    public Task<NewsletterDocument?> GetNewsletterAsync(Guid id, CancellationToken cancellationToken) =>
        _newsletters.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task<bool> InsertNewsletterAsync(NewsletterDocument newsletter, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        try
        {
            await _newsletters.InsertOneAsync(newsletter, cancellationToken: cancellationToken);
            return true;
        }
        catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task<bool> ReplaceNewsletterAsync(NewsletterDocument newsletter, int expectedVersion,
        CancellationToken cancellationToken) =>
        (await _newsletters.ReplaceOneAsync(item => item.Id == newsletter.Id && item.Version == expectedVersion &&
            item.ProductionStatus == newsletter.ProductionStatus && !item.ContentErased,
            newsletter, cancellationToken: cancellationToken)).MatchedCount == 1;

    public async Task<bool> TryClaimProductionAsync(Guid newsletterId, int version, Guid snapshotId, Guid attemptId,
        string confirmationId, string generation, string messageId, string recipient, string actorIssuer,
        string actorSubject, DateTimeOffset now, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        var result = await _newsletters.UpdateOneAsync(
            item => item.Id == newsletterId && item.Version == version && !item.Archived &&
                item.ProductionStatus == "draft" && item.TestSnapshotId == snapshotId.ToString() &&
                item.VisualApproved && item.ConfirmationId == confirmationId && !item.ConfirmationConsumed &&
                item.ConfirmationExpiresAt > now && !item.ContentErased,
            Builders<NewsletterDocument>.Update
                .Set(item => item.ProductionStatus, "submitting")
                .Set(item => item.ConfirmationConsumed, true)
                .Set(item => item.ProductionAttemptId, attemptId)
                .Set(item => item.LastProductionSnapshotId, snapshotId)
                .Set(item => item.ProductionGeneration, generation)
                .Set(item => item.ProductionMessageId, messageId)
                .Set(item => item.ProductionRecipient, recipient)
                .Set(item => item.ProductionActorIssuer, actorIssuer)
                .Set(item => item.ProductionActorSubject, actorSubject)
                .Set(item => item.ProductionStartedAt, now),
            cancellationToken: cancellationToken);
        return result.MatchedCount == 1;
    }

    public async Task<IReadOnlyList<NewsletterTemplateDocument>> ListTemplatesAsync(CancellationToken cancellationToken) =>
        await _templates.Find(_ => true).SortBy(item => item.Kind).ThenBy(item => item.Name)
            .Limit(501).ToListAsync(cancellationToken);

    public Task<NewsletterTemplateDocument?> GetTemplateAsync(Guid id, CancellationToken cancellationToken) =>
        _templates.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task<bool> InsertTemplateAsync(NewsletterTemplateDocument template, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        try
        {
            await _templates.InsertOneAsync(template, cancellationToken: cancellationToken);
            return true;
        }
        catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task<bool> ReplaceTemplateAsync(NewsletterTemplateDocument template, int expectedVersion,
        CancellationToken cancellationToken) =>
        (await _templates.ReplaceOneAsync(item => item.Id == template.Id && item.Version == expectedVersion,
            template, cancellationToken: cancellationToken)).MatchedCount == 1;

    public Task AddTemplateRevisionAsync(NewsletterTemplateRevisionDocument revision, CancellationToken cancellationToken) =>
        _revisions.InsertOneAsync(revision, cancellationToken: cancellationToken);

    public Task<NewsletterTemplateRevisionDocument?> GetTemplateRevisionAsync(Guid templateId, int version,
        CancellationToken cancellationToken) =>
        _revisions.Find(item => item.TemplateId == templateId && item.Version == version).FirstOrDefaultAsync(cancellationToken)!;

    public Task<NewsletterImageDocument?> GetImageAsync(Guid id, CancellationToken cancellationToken) =>
        _images.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task AddImageAsync(NewsletterImageDocument image, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        await _images.InsertOneAsync(image, cancellationToken: cancellationToken);
    }

    public async Task AddSnapshotAsync(NewsletterSnapshotDocument snapshot, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        await _snapshots.InsertOneAsync(snapshot, cancellationToken: cancellationToken);
    }

    public Task<NewsletterSnapshotDocument?> GetSnapshotAsync(Guid id, CancellationToken cancellationToken) =>
        _snapshots.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task<IReadOnlyList<NewsletterAttemptDocument>> GetAttemptsAsync(Guid newsletterId,
        CancellationToken cancellationToken) =>
        await _attempts.Find(item => item.NewsletterId == newsletterId).SortByDescending(item => item.OccurredAt)
            .Limit(201).ToListAsync(cancellationToken);

    public Task<NewsletterAttemptDocument?> GetAttemptAsync(Guid id, CancellationToken cancellationToken) =>
        _attempts.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task AddAttemptAsync(NewsletterAttemptDocument attempt, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        await _attempts.InsertOneAsync(attempt, cancellationToken: cancellationToken);
    }

    public async Task<bool> UpdateAttemptAsync(NewsletterAttemptDocument attempt, string expectedStatus,
        CancellationToken cancellationToken) =>
        (await _attempts.ReplaceOneAsync(item => item.Id == attempt.Id && item.Status == expectedStatus &&
                item.ReconciledAt == null,
            attempt, cancellationToken: cancellationToken)).MatchedCount == 1;

    public async Task AddConfirmationAsync(NewsletterConfirmationDocument confirmation, CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        await _confirmations.InsertOneAsync(confirmation, cancellationToken: cancellationToken);
        var result = await _newsletters.UpdateOneAsync(
            item => item.Id == confirmation.NewsletterId && item.Version == confirmation.NewsletterVersion &&
                item.ProductionStatus == "draft",
            Builders<NewsletterDocument>.Update
                .Set(item => item.ConfirmationId, confirmation.Id)
                .Set(item => item.ConfirmationExpiresAt, confirmation.ExpiresAt)
                .Set(item => item.ConfirmationOperator, confirmation.Operator)
                .Set(item => item.ConfirmationConsumed, false)
                .Set(item => item.VisualApproved, true),
            cancellationToken: cancellationToken);
        if (result.MatchedCount != 1)
        {
            await _confirmations.DeleteOneAsync(item => item.Id == confirmation.Id, CancellationToken.None);
            throw new NewsletterServiceException("newsletter_version_conflict", 409);
        }
    }

    public Task<NewsletterConfirmationDocument?> GetConfirmationAsync(string id, CancellationToken cancellationToken) =>
        _confirmations.Find(item => item.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task<bool> ConsumeConfirmationAsync(string id, CancellationToken cancellationToken) =>
        (await _confirmations.UpdateOneAsync(item => item.Id == id && !item.Consumed,
            Builders<NewsletterConfirmationDocument>.Update.Set(item => item.Consumed, true),
            cancellationToken: cancellationToken)).MatchedCount == 1;

    public Task SetTestApprovalAsync(Guid newsletterId, int version, Guid snapshotId, CancellationToken cancellationToken) =>
        _newsletters.UpdateOneAsync(item => item.Id == newsletterId && item.Version == version &&
                item.ProductionStatus == "draft" && item.ApprovedSnapshotId == snapshotId.ToString(),
            Builders<NewsletterDocument>.Update.Set(item => item.TestSnapshotId, snapshotId.ToString())
                .Set(item => item.VisualApproved, false)
                .Unset(item => item.ConfirmationId)
                .Unset(item => item.ConfirmationExpiresAt)
                .Set(item => item.ConfirmationConsumed, false),
            cancellationToken: cancellationToken);

    public async Task<bool> SetApprovalAsync(Guid newsletterId, int version, Guid snapshotId, string actorIssuer,
        string actorSubject, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var result = await _newsletters.UpdateOneAsync(item => item.Id == newsletterId && item.Version == version &&
                item.ProductionStatus == "draft" && !item.Archived,
            Builders<NewsletterDocument>.Update.Set(item => item.ApprovedSnapshotId, snapshotId.ToString())
                .Set(item => item.ApprovedAt, now)
                .Set(item => item.ApprovedByIssuer, actorIssuer)
                .Set(item => item.ApprovedBySubject, actorSubject),
            cancellationToken: cancellationToken);
        return result.MatchedCount == 1;
    }

    public async Task<bool> CompleteProductionAsync(Guid newsletterId, Guid attemptId, string status,
        CancellationToken cancellationToken)
    {
        if (status is not ("accepted" or "unknown" or "not-submitted"))
            throw new ArgumentOutOfRangeException(nameof(status));
        var update = Builders<NewsletterDocument>.Update.Set(item => item.ProductionStatus,
            status == "not-submitted" ? "draft" : status);
        if (status == "not-submitted")
            update = update
                .Set(item => item.TestSnapshotId, null)
                .Set(item => item.VisualApproved, false)
                .Unset(item => item.ConfirmationId)
                .Unset(item => item.ConfirmationExpiresAt)
                .Unset(item => item.ConfirmationOperator)
                .Set(item => item.ConfirmationConsumed, false)
                .Unset(item => item.ProductionAttemptId)
                .Unset(item => item.LastProductionSnapshotId)
                .Unset(item => item.ProductionGeneration)
                .Unset(item => item.ProductionMessageId)
                .Unset(item => item.ProductionRecipient)
                .Unset(item => item.ProductionActorIssuer)
                .Unset(item => item.ProductionActorSubject)
                .Unset(item => item.ProductionStartedAt);
        return (await _newsletters.UpdateOneAsync(item => item.Id == newsletterId &&
                item.ProductionAttemptId == attemptId &&
                (item.ProductionStatus == "submitting" || item.ProductionStatus == "unknown") &&
                !item.ContentErased, update, cancellationToken: cancellationToken)).MatchedCount == 1;
    }

    public async Task SeedTemplateAsync(NewsletterTemplateDocument template, NewsletterTemplateRevisionDocument revision,
        CancellationToken cancellationToken)
    {
        await EnsureIndexesAsync(cancellationToken);
        try
        {
            if (!await _templates.Find(item => item.Id == template.Id).AnyAsync(cancellationToken))
                await _templates.InsertOneAsync(template, cancellationToken: cancellationToken);
        }
        catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
        }
        if (!await _revisions.Find(item => item.TemplateId == revision.TemplateId &&
                item.Version == revision.Version).AnyAsync(cancellationToken))
        {
            try
            {
                await _revisions.InsertOneAsync(revision, cancellationToken: cancellationToken);
            }
            catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
            }
        }
    }

    public async Task<IReadOnlyList<NewsletterAttemptDocument>> PendingProductionAttemptsAsync(CancellationToken cancellationToken) =>
        await _attempts.Find(item => item.Mode == "production" && (item.Status == "submitting" || item.Status == "unknown"))
            .Limit(501).ToListAsync(cancellationToken);

    public async Task<bool> HasPendingProductionAsync(CancellationToken cancellationToken) =>
        await _newsletters.Find(item => item.ProductionStatus == "submitting" || item.ProductionStatus == "unknown")
            .Limit(1).AnyAsync(cancellationToken);

    public async Task<IReadOnlyList<string>> InspectAccountDataAsync(string issuer, string subject,
        CancellationToken cancellationToken)
    {
        var imageIds = await _images.Find(item => item.OwnerIssuer == issuer && item.OwnerSubject == subject)
            .Project(item => item.Id).ToListAsync(cancellationToken);
        var ownedCids = imageIds.Select(id => id.ToString("N") + "@newsletter").ToArray();
        var imageNewsletterIds = ownedCids.Length == 0 ? [] :
            (await _snapshots.Find(item => item.Images.Any(image => ownedCids.Contains(image.Cid)))
                .Project(item => item.NewsletterId).ToListAsync(cancellationToken)).ToArray();
        var newsletters = await _newsletters.Find(item =>
            item.CreatedByIssuer == issuer && item.CreatedBySubject == subject ||
            item.UpdatedByIssuer == issuer && item.UpdatedBySubject == subject ||
            item.ProductionActorIssuer == issuer && item.ProductionActorSubject == subject ||
            imageNewsletterIds.Contains(item.Id))
            .ToListAsync(cancellationToken);
        var blockers = new List<string>();
        foreach (var newsletter in newsletters)
        {
            if (newsletter.ProductionStatus is "submitting" or "unknown")
                blockers.Add($"newsletter_pending_reconciliation:{newsletter.Id:D}");
        }
        var newsletterIds = newsletters.Select(item => item.Id).ToArray();
        var attempts = await _attempts.Find(item =>
                (item.ActorIssuer == issuer && item.ActorSubject == subject ||
                 newsletterIds.Contains(item.NewsletterId) ||
                 item.ReconciledByIssuer == issuer && item.ReconciledBySubject == subject) &&
                (item.Status == "submitting" || item.Status == "unknown"))
            .ToListAsync(cancellationToken);
        blockers.AddRange(attempts.Select(item => $"newsletter_pending_attempt:{item.Id:D}"));
        return blockers;
    }

    public async Task<IReadOnlyList<BsonDocument>> ExportAccountDataAsync(string issuer, string subject,
        CancellationToken cancellationToken)
    {
        var newsletterDocs = await _newsletters.Find(item =>
            item.CreatedByIssuer == issuer && item.CreatedBySubject == subject ||
            item.UpdatedByIssuer == issuer && item.UpdatedBySubject == subject ||
            item.ProductionActorIssuer == issuer && item.ProductionActorSubject == subject ||
            item.ApprovedByIssuer == issuer && item.ApprovedBySubject == subject ||
            item.ConfirmationOperator == issuer + "|" + subject).Limit(1001).ToListAsync(cancellationToken);
        var templateDocs = await _templates.Find(item =>
            item.CreatedByIssuer == issuer && item.CreatedBySubject == subject ||
            item.UpdatedByIssuer == issuer && item.UpdatedBySubject == subject).Limit(1001).ToListAsync(cancellationToken);
        var newsletterIds = newsletterDocs.Select(item => item.Id).ToArray();
        var templateIds = templateDocs.Select(item => item.Id).ToArray();
        var attemptDocs = await _attempts.Find(item =>
                item.ActorIssuer == issuer && item.ActorSubject == subject ||
                item.ReconciledByIssuer == issuer && item.ReconciledBySubject == subject ||
                newsletterIds.Contains(item.NewsletterId))
            .Limit(1001).ToListAsync(cancellationToken);
        var imageDocs = await _images.Find(item => item.OwnerIssuer == issuer && item.OwnerSubject == subject)
            .Limit(1001).ToListAsync(cancellationToken);
        var revisionDocs = await _revisions.Find(item => templateIds.Contains(item.TemplateId) ||
                item.CreatedByIssuer == issuer && item.CreatedBySubject == subject)
            .Limit(1001).ToListAsync(cancellationToken);
        var snapshotDocs = await _snapshots.Find(item => newsletterIds.Contains(item.NewsletterId))
            .Limit(1001).ToListAsync(cancellationToken);
        var confirmationDocs = await _confirmations.Find(item =>
                newsletterIds.Contains(item.NewsletterId) || item.Operator == issuer + "|" + subject)
            .Limit(1001).ToListAsync(cancellationToken);
        var records = newsletterDocs.Select(item => ExportItem("newsletter", item.ToBsonDocument()))
            .Concat(templateDocs.Select(item => ExportItem("newsletter-template", item.ToBsonDocument())))
            .Concat(revisionDocs.Select(item => ExportItem("newsletter-template-revision", item.ToBsonDocument())))
            .Concat(attemptDocs.Select(item => ExportItem("newsletter-attempt", item.ToBsonDocument())))
            .Concat(snapshotDocs.Select(item => ExportItem("newsletter-snapshot", item.ToBsonDocument())))
            .Concat(confirmationDocs.Select(item => ExportItem("newsletter-confirmation", item.ToBsonDocument())))
            .Concat(imageDocs.Select(item => ExportItem("newsletter-image", item.ToBsonDocument())));
        return PrepareAccountExport(records, issuer, subject);
    }

    public async Task EraseAccountDataAsync(string issuer, string subject, CancellationToken cancellationToken)
    {
        var blockers = await InspectAccountDataAsync(issuer, subject, cancellationToken);
        if (blockers.Count != 0)
            throw new NewsletterServiceException("newsletter_pending_reconciliation", 409);

        var ownedNewsletterIds = await _newsletters.Find(item =>
                item.CreatedByIssuer == issuer && item.CreatedBySubject == subject ||
                item.UpdatedByIssuer == issuer && item.UpdatedBySubject == subject)
            .Project(item => item.Id).ToListAsync(cancellationToken);
        var ownedTemplateIds = await _templates.Find(item =>
                item.CreatedByIssuer == issuer && item.CreatedBySubject == subject ||
                item.UpdatedByIssuer == issuer && item.UpdatedBySubject == subject)
            .Project(item => item.Id).ToListAsync(cancellationToken);
        var newsletterIdSet = ownedNewsletterIds.ToArray();

        foreach (var id in ownedNewsletterIds)
        {
            var item = await GetNewsletterAsync(id, cancellationToken);
            if (item is null) continue;
            await _snapshots.DeleteManyAsync(snapshot => snapshot.NewsletterId == id, cancellationToken);
            var hasProductionClaim = item.ProductionAttemptId is not null ||
                item.ProductionStatus != "draft" ||
                await _attempts.Find(attempt => attempt.NewsletterId == id && attempt.Mode == "production")
                    .AnyAsync(cancellationToken);
            if (hasProductionClaim)
            {
                item.Title = "";
                item.Subject = "";
                item.Markdown = "";
                item.EventSnapshot = null;
                item.CreatedByIssuer = null;
                item.CreatedBySubject = null;
                item.UpdatedByIssuer = null;
                item.UpdatedBySubject = null;
                item.ProductionRecipient = null;
                item.ProductionActorIssuer = null;
                item.ProductionActorSubject = null;
                item.ApprovedByIssuer = null;
                item.ApprovedBySubject = null;
                item.ConfirmationId = null;
                item.ConfirmationExpiresAt = null;
                item.ConfirmationOperator = null;
                item.ConfirmationConsumed = true;
                item.VisualApproved = false;
                item.ContentErased = true;
                item.Archived = true;
                await _newsletters.ReplaceOneAsync(current => current.Id == id, item, cancellationToken: cancellationToken);
            }
            else
            {
                await _newsletters.DeleteOneAsync(current => current.Id == id, cancellationToken);
            }
        }
        await _attempts.UpdateManyAsync(attempt =>
                attempt.ActorIssuer == issuer && attempt.ActorSubject == subject ||
                newsletterIdSet.Contains(attempt.NewsletterId),
            Builders<NewsletterAttemptDocument>.Update
                .Unset(attempt => attempt.Recipient)
                .Unset(attempt => attempt.ActorIssuer)
                .Unset(attempt => attempt.ActorSubject)
                .Unset(attempt => attempt.ReconciledByIssuer)
                .Unset(attempt => attempt.ReconciledBySubject)
                .Unset(attempt => attempt.ReconciliationReason),
            cancellationToken: cancellationToken);
        await _attempts.UpdateManyAsync(attempt =>
                attempt.ReconciledByIssuer == issuer && attempt.ReconciledBySubject == subject,
            Builders<NewsletterAttemptDocument>.Update
                .Unset(attempt => attempt.ReconciledByIssuer)
                .Unset(attempt => attempt.ReconciledBySubject)
                .Unset(attempt => attempt.ReconciliationReason),
            cancellationToken: cancellationToken);
        await _newsletters.UpdateManyAsync(item =>
                item.ProductionActorIssuer == issuer && item.ProductionActorSubject == subject,
            Builders<NewsletterDocument>.Update
                .Unset(item => item.ProductionActorIssuer)
                .Unset(item => item.ProductionActorSubject),
            cancellationToken: cancellationToken);
        await _newsletters.UpdateManyAsync(item =>
                item.ApprovedByIssuer == issuer && item.ApprovedBySubject == subject,
            Builders<NewsletterDocument>.Update
                .Unset(item => item.ApprovedByIssuer)
                .Unset(item => item.ApprovedBySubject),
            cancellationToken: cancellationToken);
        foreach (var id in ownedTemplateIds)
        {
            await _revisions.DeleteManyAsync(item => item.TemplateId == id ||
                item.CreatedByIssuer == issuer && item.CreatedBySubject == subject, cancellationToken);
            await _templates.DeleteOneAsync(item => item.Id == id, cancellationToken);
        }
        await _revisions.DeleteManyAsync(item =>
            item.CreatedByIssuer == issuer && item.CreatedBySubject == subject, cancellationToken);
        await _newsletters.UpdateManyAsync(item => item.ConfirmationOperator == issuer + "|" + subject,
            Builders<NewsletterDocument>.Update
                .Unset(item => item.ConfirmationOperator)
                .Unset(item => item.ConfirmationId)
                .Unset(item => item.ConfirmationExpiresAt)
                .Set(item => item.ConfirmationConsumed, true)
                .Set(item => item.VisualApproved, false),
            cancellationToken: cancellationToken);
        var ownedImages = await _images.Find(item => item.OwnerIssuer == issuer && item.OwnerSubject == subject)
            .ToListAsync(cancellationToken);
        foreach (var image in ownedImages)
        {
            var cid = image.Id.ToString("N") + "@newsletter";
            await _snapshots.DeleteManyAsync(item => item.Images.Any(snapshotImage => snapshotImage.Cid == cid),
                cancellationToken);
            await _images.DeleteOneAsync(item => item.Id == image.Id, cancellationToken);
        }
        await _confirmations.DeleteManyAsync(item =>
            newsletterIdSet.Contains(item.NewsletterId) || item.Operator == issuer + "|" + subject,
            cancellationToken);
    }

    private static BsonDocument ExportItem(string kind, BsonDocument document) =>
        new() { ["kind"] = kind, ["document"] = document };

    internal static IReadOnlyList<BsonDocument> PrepareAccountExport(IEnumerable<BsonDocument> records,
        string issuer, string subject)
    {
        var exported = records.Take(1001).ToArray();
        if (exported.Length > 1000)
            throw new NewsletterServiceException("newsletter_export_limit_exceeded", 409);
        return exported.Select(wrapper =>
        {
            var copy = wrapper.DeepClone().AsBsonDocument;
            var document = copy["document"].AsBsonDocument;
            bool IsOwn(string prefix) =>
                document.GetValue(prefix + "Issuer", BsonNull.Value) == issuer &&
                document.GetValue(prefix + "Subject", BsonNull.Value) == subject;
            if (copy["kind"] == "newsletter-attempt" && !IsOwn("Actor"))
                document.Remove("Recipient");
            if (!IsOwn("ReconciledBy"))
                document.Remove("ReconciliationReason");
            foreach (var prefix in new[] { "CreatedBy", "UpdatedBy", "Actor", "ProductionActor", "ReconciledBy", "Owner" })
            {
                if (IsOwn(prefix)) continue;
                document.Remove(prefix + "Issuer");
                document.Remove(prefix + "Subject");
            }
            document.Remove("ConfirmationId");
            if (copy["kind"] == "newsletter-confirmation")
                document.Remove("_id");
            foreach (var field in new[] { "Operator", "ConfirmationOperator" })
                if (document.GetValue(field, BsonNull.Value) != issuer + "|" + subject)
                    document.Remove(field);
            return copy;
        }).ToArray();
    }

    private async Task EnsureIndexesAsync(CancellationToken cancellationToken)
    {
        var indexes = _indexes ??= CreateIndexesAsync();
        try
        {
            await indexes.WaitAsync(cancellationToken);
        }
        catch
        {
            _ = Interlocked.CompareExchange(ref _indexes, null, indexes);
            throw;
        }
    }

    private async Task CreateIndexesAsync()
    {
        await _newsletters.Indexes.CreateOneAsync(new CreateIndexModel<NewsletterDocument>(
            Builders<NewsletterDocument>.IndexKeys.Descending(item => item.UpdatedAt)));
        await _revisions.Indexes.CreateOneAsync(new CreateIndexModel<NewsletterTemplateRevisionDocument>(
            Builders<NewsletterTemplateRevisionDocument>.IndexKeys.Ascending(item => item.TemplateId)
                .Ascending(item => item.Version), new CreateIndexOptions { Unique = true, Name = "TemplateRevision_unique" }));
        await _attempts.Indexes.CreateOneAsync(new CreateIndexModel<NewsletterAttemptDocument>(
            Builders<NewsletterAttemptDocument>.IndexKeys.Ascending(item => item.NewsletterId)
                .Descending(item => item.OccurredAt)));
        await _snapshots.Indexes.CreateOneAsync(new CreateIndexModel<NewsletterSnapshotDocument>(
            Builders<NewsletterSnapshotDocument>.IndexKeys.Ascending(item => item.NewsletterId)
                .Descending(item => item.CreatedAt)));
    }
}
