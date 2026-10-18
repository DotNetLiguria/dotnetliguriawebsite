using System.Text.Json;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Security;

namespace DotNetLiguriaCore.Services.Questionnaires;

public class QuestionnaireService(IQuestionnaireStore store, TimeProvider timeProvider)
{
    private const string _notFound = "Questionario non trovato.";

    private DateTime UtcNow => timeProvider.GetUtcNow().UtcDateTime;

    public async Task<List<QuestionnaireSummary>> ListAsync(CancellationToken cancellationToken = default, CollectionWindow? page = null)
    {
        var questionnaires = await store.ListAsync(cancellationToken, page);
        var counts = await store.CountResponsesAsync(cancellationToken,
            questionnaires.Select(q => q.QuestionnaireId).ToArray());
        var summaries = new List<QuestionnaireSummary>();
        foreach (var q in questionnaires)
        {
            summaries.Add(new QuestionnaireSummary
            {
            QuestionnaireId = q.QuestionnaireId,
            Title = q.Title,
            Status = q.Status,
            WorkshopId = q.WorkshopId,
            OpensAt = q.OpensAt,
            ClosesAt = q.ClosesAt,
            ResponseCount = counts.GetValueOrDefault(q.QuestionnaireId),
            UpdatedAt = q.UpdatedAt,
            Origin = q.Origin,
            });
        }
        return summaries;
    }

    public async Task<Questionnaire?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var questionnaire = await store.GetAsync(id, cancellationToken);
        if (questionnaire is not null)
        {
            questionnaire.ResponseCount = await store.CountResponsesAsync(id, cancellationToken);
        }

        return questionnaire;
    }

    public async Task<List<Questionnaire>> GetByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default,
        CollectionWindow? page = null) =>
        await store.GetByWorkshopAsync(workshopId, cancellationToken, page);

    public async Task<Questionnaire> CreateAsync(CreateQuestionnaireRequest request, Workshop? workshop, string? user,
        CancellationToken cancellationToken = default)
    {
        var questionnaire = workshop is not null && string.Equals(request.Template, "workshopFeedback", StringComparison.OrdinalIgnoreCase)
            ? QuestionnaireTemplates.CreateWorkshopFeedback(workshop, UtcNow)
            : QuestionnaireTemplates.CreateBlank(request.Title, UtcNow);
        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            questionnaire.Title = request.Title.Trim();
        }

        questionnaire.WorkshopId ??= workshop?.WorkshopId;
        questionnaire.CreatedBy = user;
        await store.CreateAsync(questionnaire, cancellationToken);
        return questionnaire;
    }

    public async Task<QuestionnaireOperationResult<Questionnaire>> UpdateAsync(Guid id, Questionnaire updated,
        CancellationToken cancellationToken = default)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        if (updated.Version != existing.Version)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Conflict,
                "Il questionario è stato modificato da un'altra sessione. Ricarica la pagina.");
        }

        var errors = QuestionnaireDefinitionValidator.Validate(updated, existing.Status == QuestionnaireStatus.Published);
        if (errors.Count > 0)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Invalid,
                "Il questionario contiene errori.", errors);
        }

        var responseCount = await store.CountResponsesAsync(id, cancellationToken);
        if (responseCount > 0 && !QuestionnaireStructure.IsCompatible(existing, updated))
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Conflict,
                "Il questionario ha già delle risposte: puoi modificare i testi ma non aggiungere, rimuovere o cambiare il tipo delle domande. Duplica il questionario per cambiarne la struttura.");
        }

        updated.QuestionnaireId = existing.QuestionnaireId;
        updated.Status = existing.Status;
        updated.CreatedAt = existing.CreatedAt;
        updated.CreatedBy = existing.CreatedBy;
        updated.PublishedAt = existing.PublishedAt;
        updated.Origin = existing.Origin;
        return await SaveAsync(updated, existing.Version, responseCount, cancellationToken);
    }

    public async Task<QuestionnaireOperationResult<Questionnaire>> DuplicateAsync(Guid id, string? user,
        CancellationToken cancellationToken = default)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        var copy = JsonSerializer.Deserialize<Questionnaire>(JsonSerializer.Serialize(existing))!;
        copy.QuestionnaireId = Guid.NewGuid();
        copy.Title = $"{existing.Title} (copia)";
        copy.Status = QuestionnaireStatus.Draft;
        copy.Version = 1;
        copy.CreatedBy = user;
        copy.CreatedAt = UtcNow;
        copy.UpdatedAt = UtcNow;
        copy.PublishedAt = null;
        copy.Origin = ResponseSource.Web;
        copy.ResponseCount = 0;
        await store.CreateAsync(copy, cancellationToken);
        return QuestionnaireOperationResult<Questionnaire>.Ok(copy);
    }

    public async Task<QuestionnaireOperationResult<Questionnaire>> PublishAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        var errors = QuestionnaireDefinitionValidator.Validate(existing, forPublish: true);
        if (errors.Count > 0)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Invalid,
                "Correggi gli errori prima di pubblicare.", errors);
        }

        var version = existing.Version;
        existing.Status = QuestionnaireStatus.Published;
        existing.PublishedAt ??= UtcNow;
        if (existing.ClosesAt.HasValue && existing.ClosesAt <= UtcNow)
        {
            existing.ClosesAt = null;
        }

        return await SaveAsync(existing, version, null, cancellationToken);
    }

    public Task<QuestionnaireOperationResult<Questionnaire>> CloseAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeStatusAsync(id, QuestionnaireStatus.Closed, [QuestionnaireStatus.Published], cancellationToken);

    public Task<QuestionnaireOperationResult<Questionnaire>> ArchiveAsync(Guid id, CancellationToken cancellationToken = default) =>
        ChangeStatusAsync(id, QuestionnaireStatus.Archived,
            [QuestionnaireStatus.Draft, QuestionnaireStatus.Published, QuestionnaireStatus.Closed], cancellationToken);

    // Reopening goes back through publish so the definition is validated again.
    public async Task<QuestionnaireOperationResult<Questionnaire>> ReopenAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        if (existing.Status is not (QuestionnaireStatus.Closed or QuestionnaireStatus.Archived))
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Conflict,
                "Solo un questionario chiuso o archiviato può essere riaperto.");
        }

        return await PublishAsync(id, cancellationToken);
    }

    public async Task<QuestionnaireOperationResult<bool>> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<bool>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        if (await store.CountResponsesAsync(id, cancellationToken) > 0)
        {
            return QuestionnaireOperationResult<bool>.Fail(QuestionnaireOperationStatus.Conflict,
                "Il questionario ha delle risposte: archivialo invece di eliminarlo.");
        }

        await store.DeleteAsync(id, cancellationToken);
        return QuestionnaireOperationResult<bool>.Ok(true);
    }

    public async Task<QuestionnaireStatistics?> GetStatisticsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var questionnaire = await store.GetAsync(id, cancellationToken);
        return questionnaire is null
            ? null
            : QuestionnaireStatisticsCalculator.Calculate(questionnaire, await store.GetResponsesAsync(id, cancellationToken));
    }

    public async Task<List<QuestionnaireResponse>?> GetResponsesAsync(Guid id, CancellationToken cancellationToken = default,
        CollectionWindow? page = null)
    {
        var questionnaire = await store.GetAsync(id, cancellationToken);
        return questionnaire is null ? null : await store.GetResponsesAsync(id, cancellationToken, page);
    }

    public Task<bool> DeleteResponseAsync(Guid id, Guid responseId, CancellationToken cancellationToken = default) =>
        store.DeleteResponseAsync(id, responseId, cancellationToken);

    public async Task<(Questionnaire Questionnaire, string Csv)?> ExportCsvAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var questionnaire = await store.GetAsync(id, cancellationToken);
        if (questionnaire is null)
        {
            return null;
        }

        var responses = await store.GetResponsesAsync(id, cancellationToken);
        return (questionnaire, QuestionnaireCsvExporter.Export(questionnaire, responses));
    }

    public async Task<PublicQuestionnaireView?> GetPublicAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var questionnaire = await store.GetAsync(id, cancellationToken);
        return questionnaire is null || questionnaire.Status == QuestionnaireStatus.Draft ? null : ToPublicView(questionnaire);
    }

    // Prefers an open questionnaire, then the most recently published one.
    public async Task<PublicQuestionnaireView?> GetPublicByWorkshopAsync(Guid workshopId, CancellationToken cancellationToken = default)
    {
        var candidates = (await store.GetByWorkshopAsync(workshopId, cancellationToken))
            .Where(q => q.Status is QuestionnaireStatus.Published or QuestionnaireStatus.Closed)
            .ToList();
        var chosen = candidates.FirstOrDefault(q => QuestionnaireResponseValidator.CheckAvailability(q, UtcNow) == QuestionnaireAvailability.Open)
            ?? candidates.OrderByDescending(q => q.PublishedAt ?? q.UpdatedAt).FirstOrDefault();
        return chosen is null ? null : ToPublicView(chosen);
    }

    public async Task<QuestionnaireOperationResult<Guid>> SubmitAsync(Guid id, SubmitQuestionnaireResponseRequest request,
        CancellationToken cancellationToken = default, AccountIdentity? account = null)
    {
        // Honeypot: bots get a success response but nothing is stored.
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            return QuestionnaireOperationResult<Guid>.Ok(Guid.Empty);
        }

        var questionnaire = await store.GetAsync(id, cancellationToken);
        if (questionnaire is null || questionnaire.Status == QuestionnaireStatus.Draft)
        {
            return QuestionnaireOperationResult<Guid>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        if (QuestionnaireResponseValidator.CheckAvailability(questionnaire, UtcNow) != QuestionnaireAvailability.Open)
        {
            return QuestionnaireOperationResult<Guid>.Fail(QuestionnaireOperationStatus.Unavailable,
                "Il questionario non accetta risposte in questo momento.");
        }
        var requiresAccount = questionnaire.RespondentMode is RespondentMode.Identified or RespondentMode.Authenticated;
        if (requiresAccount && account is null)
            return QuestionnaireOperationResult<Guid>.Fail(QuestionnaireOperationStatus.Unauthorized,
                "Accedi con Keycloak per compilare questo questionario.");

        var validation = QuestionnaireResponseValidator.Validate(questionnaire, request);
        if (!validation.IsValid)
        {
            return QuestionnaireOperationResult<Guid>.Fail(QuestionnaireOperationStatus.Invalid,
                "Alcune risposte non sono valide.", validation.Errors);
        }

        var response = new QuestionnaireResponse
        {
            ResponseId = Guid.NewGuid(),
            QuestionnaireId = questionnaire.QuestionnaireId,
            QuestionnaireVersion = questionnaire.Version,
            SubmittedAt = UtcNow,
            AccountIssuer = requiresAccount ? account?.Issuer : null,
            AccountSubject = requiresAccount ? account?.Subject : null,
            ConsentGiven = request.ConsentGiven,
            Answers = validation.Answers,
            Source = ResponseSource.Web,
        };

        if ((questionnaire.OnePerEmail || questionnaire.OnePerAccount) && requiresAccount && account is not null)
        {
            response.UniqueAccountKey = JsonSerializer.Serialize(new[] { questionnaire.QuestionnaireId.ToString("N"),
                account.Issuer, account.Subject });
            if (await store.HasResponseFromAsync(questionnaire.QuestionnaireId, response.UniqueAccountKey, cancellationToken))
            {
                return Duplicate();
            }
        }

        return await store.InsertResponseAsync(response, cancellationToken)
            ? QuestionnaireOperationResult<Guid>.Ok(response.ResponseId)
            : Duplicate();

        static QuestionnaireOperationResult<Guid> Duplicate() => QuestionnaireOperationResult<Guid>.Fail(
            QuestionnaireOperationStatus.Duplicate, "Hai già compilato questo questionario con questo account.");
    }

    private PublicQuestionnaireView ToPublicView(Questionnaire questionnaire)
    {
        var availability = QuestionnaireResponseValidator.CheckAvailability(questionnaire, UtcNow);
        Questionnaire? definition = null;
        if (availability == QuestionnaireAvailability.Open)
        {
            definition = questionnaire;
            definition.CreatedBy = null;
        }

        return new PublicQuestionnaireView
        {
            QuestionnaireId = questionnaire.QuestionnaireId,
            Title = questionnaire.Title,
            Availability = availability,
            OpensAt = questionnaire.OpensAt,
            ClosesAt = questionnaire.ClosesAt,
            Questionnaire = definition,
        };
    }

    private async Task<QuestionnaireOperationResult<Questionnaire>> ChangeStatusAsync(Guid id, QuestionnaireStatus target,
        QuestionnaireStatus[] allowedFrom, CancellationToken cancellationToken)
    {
        var existing = await store.GetAsync(id, cancellationToken);
        if (existing is null)
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.NotFound, _notFound);
        }

        if (!allowedFrom.Contains(existing.Status))
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Conflict,
                "Operazione non consentita nello stato attuale.");
        }

        var version = existing.Version;
        existing.Status = target;
        return await SaveAsync(existing, version, null, cancellationToken);
    }

    private async Task<QuestionnaireOperationResult<Questionnaire>> SaveAsync(Questionnaire questionnaire, int expectedVersion,
        long? responseCount, CancellationToken cancellationToken)
    {
        questionnaire.Version = expectedVersion + 1;
        questionnaire.UpdatedAt = UtcNow;
        if (!await store.ReplaceAsync(questionnaire, expectedVersion, cancellationToken))
        {
            return QuestionnaireOperationResult<Questionnaire>.Fail(QuestionnaireOperationStatus.Conflict,
                "Il questionario è stato modificato da un'altra sessione. Ricarica la pagina.");
        }

        questionnaire.ResponseCount = responseCount ?? await store.CountResponsesAsync(questionnaire.QuestionnaireId, cancellationToken);
        return QuestionnaireOperationResult<Questionnaire>.Ok(questionnaire);
    }
}
