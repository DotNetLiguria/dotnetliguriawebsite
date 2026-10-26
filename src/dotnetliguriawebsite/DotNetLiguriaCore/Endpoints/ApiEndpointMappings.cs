using System.Security.Claims;
using System.Text;
using CommonWeb;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Storage;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Endpoints;

public static class ApiEndpointMappings
{
    private static readonly string[] _weatherSummaries =
    [
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching",
    ];

    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api")
            .AddEndpointFilter<PermissionOperationFilter>()
            .AddEndpointFilter<EditorInputFilter>()
            .ApplyPermissions();
        MapBackupEndpoints(api);
        MapBoardEndpoints(api);
        MapCounterEndpoints(api);
        MapEventbriteEndpoints(api);
        MapPublicQuestionnaireEndpoints(api);
        MapQuestionnaireEndpoints(api);
        MapSpeakerEndpoints(api);
        MapTopMenuEndpoints(api);
        MapValuesEndpoints(api);
        MapVenueEndpoints(api);
        MapWeatherForecastEndpoints(endpoints);
        MapWorkshopEndpoints(api);
        MapWorkshopFileEndpoints(api);
        return endpoints;
    }

    private static void MapBackupEndpoints(RouteGroupBuilder api)
    {
        var backup = api.MapGroup("/Backup").WithTags("Backup")
            .RequireAuthorization();

        backup.MapGet("/snapshots", async (DatabaseBackupService backupService, CancellationToken cancellationToken) =>
            Results.Ok(await backupService.ListAsync(cancellationToken)));
        backup.MapPost("/export", async (string? name, DatabaseBackupService backupService,
            ILoggerFactory loggerFactory, CancellationToken cancellationToken) =>
        {
            if (!DatabaseBackupService.IsValidSnapshotName(name))
            {
                loggerFactory.CreateLogger("DotNetLiguriaCore.Endpoints.Backup")
                    .LogWarning("Rejected an invalid database backup name.");
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Nome del backup non valido",
                    Detail = "Il nome può contenere al massimo 120 caratteri e non può contenere caratteri di controllo.",
                });
            }
            return Results.Ok(await backupService.CreateAsync(cancellationToken, name));
        });
        backup.MapPost("/import", async (
            BackupRestoreRequest request,
            DatabaseBackupService backupService,
            HttpContext context,
            TimeProvider timeProvider,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            if (!RecentMfa.IsSatisfied(context.User, timeProvider))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden,
                    title: "RecentMfaRequired", detail: "Ripeti l'accesso con MFA prima di ripristinare un backup.");
            if (!request.ConfirmReplace)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Conferma richiesta",
                    Detail = "Confermare esplicitamente la sostituzione dei dati prima di importare il backup.",
                });
            }

            var logger = loggerFactory.CreateLogger("DotNetLiguriaCore.Endpoints.Backup");
            try
            {
                var result = await backupService.RestoreAsync(request.SnapshotId, cancellationToken);
                return result is null ? Results.NotFound() : Results.Ok(result);
            }
            catch (ArgumentException exception)
            {
                logger.LogWarning(exception, "Rejected an invalid database backup snapshot identifier.");
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Snapshot non valido",
                    Detail = "L'identificativo del backup selezionato non è valido.",
                });
            }
            catch (InvalidDataException exception)
            {
                logger.LogWarning(exception, "Rejected an invalid database backup snapshot.");
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Backup non valido",
                    Detail = "Il backup selezionato non è integro o non è supportato. Nessun dato è stato sostituito.",
                });
            }
        });
    }

    private static void MapBoardEndpoints(RouteGroupBuilder api)
    {
        var board = api.MapGroup("/Board").WithTags("Board").AddEndpointFilter<PrivacyEndpointFilter>();
        board.MapGet("/Get", async (bool? onlyActive, HttpContext context, BoardService boardService,
            IAuthorizationService authorizationService) =>
        {
            if (await context.HasAdministrativeReadAccessAsync(authorizationService))
            {
                return Results.Ok(await boardService.GetAsync(onlyActive ?? false));
            }

            var publicBoards = (await boardService.GetAsync(onlyActive: true)).Select(ToPublicBoard);
            return Results.Ok(publicBoards);
        }).AllowAnonymous();
        board.MapGet("/Get/{id}", async (Guid id, HttpContext context, BoardService boardService,
            IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.HasAdministrativeReadAccessAsync(authorizationService);
            var item = await boardService.GetAsync(id);
            if (item is null || (!isAdmin && !item.IsActive))
            {
                return Results.NotFound();
            }

            return isAdmin ? Results.Ok(item) : Results.Ok(ToPublicBoard(item));
        }).AllowAnonymous().WithName("BoardGetById");
        board.MapPost("/Post", async (Board newBoard, BoardService boardService) =>
        {
            if (string.IsNullOrWhiteSpace(newBoard.Name))
            {
                return Results.BadRequest("A board member name is required.");
            }

            newBoard.BoardId = Guid.NewGuid();
            await boardService.CreateAsync(newBoard);
            return Results.CreatedAtRoute("BoardGetById", new { id = newBoard.BoardId }, newBoard);
        }).RequireAuthorization();
        board.MapPut("/Update/{id}", async (Guid id, Board updateBoard, BoardService boardService) =>
        {
            var item = await boardService.GetAsync(id);
            if (item is null)
            {
                return Results.NotFound();
            }
            if (string.IsNullOrWhiteSpace(updateBoard.Name))
            {
                return Results.BadRequest("A board member name is required.");
            }

            updateBoard.BoardId = item.BoardId;
            await boardService.UpdateAsync(id, updateBoard);
            return Results.NoContent();
        }).RequireAuthorization();
        board.MapDelete("/Delete/{id}", async (Guid id, BoardService boardService) =>
        {
            if (await boardService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }

            await boardService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void MapCounterEndpoints(RouteGroupBuilder api)
    {
        var counter = api.MapGroup("/Counter").WithTags("Counter");
        counter.MapGet("/Get", async (CounterService counterService) => Results.Ok(await counterService.GetAsync()));
        counter.MapGet("/Get/{id}", async (string id, CounterService counterService) =>
        {
            if (!Guid.TryParse(id, out var counterId))
            {
                return InvalidGuid("id", id);
            }

            return await counterService.GetAsync(counterId) is { } item ? Results.Ok(item) : Results.NotFound();
        }).WithName("CounterGetById");
        counter.MapGet("/GetByName/{name}", async (string name, CounterService counterService) =>
        {
            var item = await counterService.GetByNameAsync(name);
            if (item is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(new CounterGetModel
            {
                CounterId = item.CounterId,
                Name = item.Name,
                Value = item.Value ?? 0,
            });
        });
        counter.MapPost("/Post", async (Counter newCounter, CounterService counterService) =>
        {
            await counterService.CreateAsync(newCounter);
            return Results.CreatedAtRoute("CounterGetById", new { id = newCounter.CounterId }, newCounter);
        }).RequireAuthorization();
        counter.MapPut("/Update/{id}", async (Guid id, Counter updatedCounter, CounterService counterService) =>
        {
            if (await counterService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }

            await counterService.UpdateAsync(id, updatedCounter);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void MapEventbriteEndpoints(RouteGroupBuilder api)
    {
        var eventbrite = api.MapGroup("/Eventbrite").WithTags("Eventbrite")
            .RequireAuthorization();
        eventbrite.MapPut("/Configuration/{id:guid}", async (
            Guid id, EventbriteConfigurationRequest request, WorkshopService workshopService,
            IOptions<EventbriteOptions> options) =>
        {
            var workshop = await workshopService.GetAsync(id);
            if (workshop is null) return Results.NotFound();
            try
            {
                var zone = TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZoneId);
                _ = EventbriteSalesTimes.ToUtc(request.SalesStart, request.SalesEnd, zone);
            }
            catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
                return Results.Problem(statusCode: 503, title: "Eventbrite timezone is unavailable",
                    extensions: new Dictionary<string, object?> { ["code"] = "eventbrite_timezone_unavailable" });
            }
            catch (ArgumentException exception)
            {
                return Results.Problem(statusCode: 400, title: "Invalid Eventbrite sales window",
                    detail: exception.Message,
                    extensions: new Dictionary<string, object?> { ["code"] = "eventbrite_sales_window_invalid" });
            }
            request.ApplyTo(workshop);
            await workshopService.UpdateEventbriteConfigurationAsync(workshop);
            return Results.NoContent();
        });
        eventbrite.MapPost("/Sync/{id:guid}", async (
            Guid id, WorkshopService workshopService, EventbriteIntegrationService integrationService,
            CancellationToken cancellationToken) =>
        {
            var workshop = await workshopService.GetAsync(id);
            if (workshop is null)
            {
                return Results.NotFound();
            }

            try
            {
                await integrationService.SyncIfReadyAsync(workshop, cancellationToken);
            }
            catch (EventbriteApiException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway,
                    title: "Eventbrite synchronization failed");
            }
            catch (InvalidOperationException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status409Conflict,
                    title: "Eventbrite synchronization needs attention");
            }
            catch (ArgumentException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status400BadRequest,
                    title: "Invalid Eventbrite event data");
            }

            return Results.Ok(await workshopService.GetAsync(id));
        });
        eventbrite.MapGet("/TicketSales/{id:guid}", async (
            Guid id, WorkshopService workshopService, EventbriteIntegrationService integrationService,
            CancellationToken cancellationToken) =>
        {
            var workshop = await workshopService.GetAsync(id);
            if (workshop is null)
            {
                return Results.NotFound();
            }

            try
            {
                return Results.Ok(await integrationService.GetTicketSalesAsync(workshop, cancellationToken));
            }
            catch (EventbriteApiException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway,
                    title: "Could not refresh Eventbrite ticket sales");
            }
            catch (InvalidOperationException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status409Conflict,
                    title: "Eventbrite ticket sales are not available");
            }
        });
        eventbrite.MapPut("/SetTicketCapacity/{id:guid}", async (
            Guid id, EventbriteTicketCapacityRequest request, WorkshopService workshopService,
            EventbriteIntegrationService integrationService, CancellationToken cancellationToken) =>
        {
            var workshop = await workshopService.GetAsync(id);
            if (workshop is null)
            {
                return Results.NotFound();
            }
            if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) ||
                string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId))
            {
                return Results.Conflict(new ProblemDetails
                {
                    Title = "Eventbrite tickets are not ready",
                    Detail = "Create and synchronize the Eventbrite draft before changing its ticket capacity.",
                    Status = StatusCodes.Status409Conflict,
                });
            }
            if (request.Capacity < workshop.EventbriteSyncedTicketCapacity)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Ticket capacity cannot be reduced",
                    Detail = $"Capacity must be at least the current total of {workshop.EventbriteSyncedTicketCapacity}.",
                    Status = StatusCodes.Status400BadRequest,
                });
            }

            EventbriteTicketSales liveSales;
            try
            {
                liveSales = await integrationService.GetTicketSalesAsync(workshop, cancellationToken);
            }
            catch (EventbriteApiException exception)
            {
                return Results.Problem(
                    $"Capacity was not changed because current Eventbrite ticket sales could not be verified: {exception.Message}",
                    statusCode: StatusCodes.Status502BadGateway, title: "Could not verify Eventbrite ticket capacity");
            }
            catch (InvalidOperationException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status409Conflict,
                    title: "Eventbrite ticket capacity is not available");
            }
            if (request.Capacity < liveSales.Sold + liveSales.Pending)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Capacity is below sold and pending tickets",
                    Detail = $"Capacity must be at least {liveSales.Sold + liveSales.Pending} (sold: {liveSales.Sold}, pending: {liveSales.Pending}).",
                    Status = StatusCodes.Status400BadRequest,
                });
            }

            workshop.EventbriteTicketCapacity = request.Capacity;
            workshop.EventbriteSyncStatus = "update-pending";
            workshop.EventbriteLastError = null;
            await workshopService.UpdateEventbriteAsync(workshop);
            return Results.Ok(await workshopService.GetAsync(id));
        });
        eventbrite.MapPost("/Publish/{id:guid}", async (
            Guid id, WorkshopService workshopService, EventbriteApiClient apiClient, CancellationToken cancellationToken) =>
        {
            var workshop = await workshopService.GetAsync(id);
            if (workshop is null)
            {
                return Results.NotFound();
            }
            if (string.IsNullOrWhiteSpace(workshop.EventbriteEventId) ||
                string.IsNullOrWhiteSpace(workshop.EventbriteTicketClassId) ||
                workshop.EventbriteSyncStatus != "synced")
            {
                return Results.Conflict(new ProblemDetails
                {
                    Title = "Eventbrite draft is not ready to publish",
                    Detail = "Synchronize the event and its free ticket before publishing.",
                    Status = StatusCodes.Status409Conflict,
                });
            }
            if (workshop.EventbritePublished)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Title = "Eventbrite event is already published",
                    Status = StatusCodes.Status409Conflict,
                });
            }

            try
            {
                using var response = await apiClient.PublishEventAsync(workshop.EventbriteEventId, cancellationToken);
                workshop.EventbritePublished = true;
                await workshopService.UpdateEventbriteAsync(workshop);
            }
            catch (EventbriteApiException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway,
                    title: "Eventbrite publishing failed");
            }
            catch (InvalidOperationException exception)
            {
                return Results.Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable,
                    title: "Eventbrite integration is not configured");
            }

            return Results.NoContent();
        });
    }

    private static void MapPublicQuestionnaireEndpoints(RouteGroupBuilder api)
    {
        var questionnaire = api.MapGroup("/PublicQuestionnaire").WithTags("Public questionnaire")
            .AllowAnonymous();
        questionnaire.MapGet("/{id:guid}", async (Guid id, QuestionnaireService service, CancellationToken cancellationToken) =>
            await service.GetPublicAsync(id, cancellationToken) is { } view ? Results.Ok(view) : Results.NotFound());
        questionnaire.MapGet("/by-workshop/{workshopId:guid}",
            async (Guid workshopId, QuestionnaireService service, CancellationToken cancellationToken) =>
                await service.GetPublicByWorkshopAsync(workshopId, cancellationToken) is { } view
                    ? Results.Ok(view) : Results.NotFound());
        questionnaire.MapPost("/{id:guid}/responses",
            async (Guid id, SubmitQuestionnaireResponseRequest request, QuestionnaireService service, HttpContext context,
                PrivacyOperationGate gate, PrivacyCoordinator privacy, IOptions<PrivacyOptions> privacyOptions,
                CancellationToken cancellationToken) =>
            {
                var authentication = await context.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
                var account = authentication.Succeeded && authentication.Principal is { } principal
                    ? AccountIdentity.FromPrincipal(principal) : null;
                using var lease = await gate.EnterAsync(cancellationToken);
                var view = await service.GetPublicAsync(id, cancellationToken);
                if (view?.Questionnaire is { RespondentMode: not RespondentMode.Anonymous })
                {
                    if (!authentication.Succeeded || account is null)
                        return Results.Challenge(authenticationSchemes: [JwtBearerDefaults.AuthenticationScheme]);
                    if (account.Issuer != privacyOptions.Value.Issuer)
                        return Results.Problem(statusCode: 403, title: "Invalid account issuer");
                    await privacy.EnsureAccountActiveAsync(
                        new AccountReference(account.Issuer, account.Subject), cancellationToken);
                }
                return QuestionnaireActionResults.From(await service.SubmitAsync(id, request, cancellationToken, account),
                    responseId => Results.Ok(new { responseId }));
            }).AddEndpointFilter<PrivacyEndpointFilter>()
            .RequireRateLimiting(PublicQuestionnaireRateLimit.PolicyName);
    }

    private static void MapQuestionnaireEndpoints(RouteGroupBuilder api)
    {
        var questionnaire = api.MapGroup("/Questionnaire").WithTags("Questionnaire")
            .RequireAuthorization()
            .AddEndpointFilter<PrivacyEndpointFilter>()
            .AddEndpointFilter<ActiveAccountWriteFilter>();
        questionnaire.MapGet("", async (QuestionnaireService service, WorkshopService workshopService, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            var page = CollectionWindow.From(context);
            var summaries = await service.ListAsync(cancellationToken, page);
            if (summaries.Any(summary => summary.WorkshopId.HasValue))
            {
                var titles = new Dictionary<Guid, string?>();
                foreach (var id in summaries.Where(summary => summary.WorkshopId.HasValue)
                    .Select(summary => summary.WorkshopId!.Value).Distinct())
                    titles[id] = (await workshopService.GetAsync(id))?.Title;
                foreach (var summary in summaries.Where(summary => summary.WorkshopId.HasValue))
                {
                    summary.WorkshopTitle = titles.GetValueOrDefault(summary.WorkshopId!.Value);
                }
            }

            page?.WriteHeaders(context);
            return Results.Ok(summaries);
        });
        questionnaire.MapGet("/{id:guid}", async (Guid id, QuestionnaireService service, CancellationToken cancellationToken) =>
            await service.GetAsync(id, cancellationToken) is { } item ? Results.Ok(item) : Results.NotFound())
            .WithName("QuestionnaireGetById");
        questionnaire.MapGet("/by-workshop/{workshopId:guid}",
            async (Guid workshopId, QuestionnaireService service, HttpContext context, CancellationToken cancellationToken) =>
            {
                var page = CollectionWindow.From(context);
                var items = await service.GetByWorkshopAsync(workshopId, cancellationToken, page);
                page?.WriteHeaders(context);
                return Results.Ok(items);
            });
        questionnaire.MapPost("", async (
            CreateQuestionnaireRequest request, HttpContext context, QuestionnaireService service,
            WorkshopService workshopService, SpeakerService speakerService, CancellationToken cancellationToken) =>
        {
            Workshop? workshop = null;
            if (request.WorkshopId is { } workshopId)
            {
                workshop = await workshopService.GetAsync(workshopId);
                if (workshop is null)
                {
                    return Results.NotFound(new QuestionnaireProblem { Code = "NotFound", Message = "Evento non trovato." });
                }

                await AddSpeakerNames(workshop, speakerService);
            }

            var item = await service.CreateAsync(request, workshop, CurrentUser(context.User), cancellationToken);
            return Results.CreatedAtRoute("QuestionnaireGetById", new { id = item.QuestionnaireId }, item);
        });
        questionnaire.MapPut("/{id:guid}", async (Guid id, Questionnaire item, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.UpdateAsync(id, item, cancellationToken), Results.Ok));
        questionnaire.MapPost("/{id:guid}/duplicate", async (Guid id, HttpContext context, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.DuplicateAsync(id, CurrentUser(context.User), cancellationToken), Results.Ok));
        questionnaire.MapPost("/{id:guid}/publish", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.PublishAsync(id, cancellationToken), Results.Ok));
        questionnaire.MapPost("/{id:guid}/close", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.CloseAsync(id, cancellationToken), Results.Ok));
        questionnaire.MapPost("/{id:guid}/reopen", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.ReopenAsync(id, cancellationToken), Results.Ok));
        questionnaire.MapPost("/{id:guid}/archive", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.ArchiveAsync(id, cancellationToken), Results.Ok));
        questionnaire.MapDelete("/{id:guid}", async (Guid id, QuestionnaireService service, CancellationToken cancellationToken) =>
            QuestionnaireActionResults.From(await service.DeleteAsync(id, cancellationToken), _ => Results.NoContent()));
        questionnaire.MapGet("/{id:guid}/statistics", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            await service.GetStatisticsAsync(id, cancellationToken) is { } statistics ? Results.Ok(statistics) : Results.NotFound());
        questionnaire.MapGet("/{id:guid}/responses", async (Guid id, QuestionnaireService service, HttpContext context,
            CancellationToken cancellationToken) =>
        {
            var page = CollectionWindow.From(context);
            var responses = await service.GetResponsesAsync(id, cancellationToken, page);
            page?.WriteHeaders(context);
            return responses is not null ? Results.Ok(responses) : Results.NotFound();
        });
        questionnaire.MapDelete("/{id:guid}/responses/{responseId:guid}", async (
            Guid id, Guid responseId, QuestionnaireService service, CancellationToken cancellationToken) =>
            await service.DeleteResponseAsync(id, responseId, cancellationToken) ? Results.NoContent() : Results.NotFound());
        questionnaire.MapGet("/{id:guid}/export", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
        {
            if (await service.ExportCsvAsync(id, cancellationToken) is not { } export)
            {
                return Results.NotFound();
            }

            var bytes = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(Encoding.UTF8.GetBytes(export.Csv)).ToArray();
            return Results.File(bytes, "text/csv; charset=utf-8", $"questionario-{export.Questionnaire.QuestionnaireId:N}.csv");
        });
    }

    private static void MapSpeakerEndpoints(RouteGroupBuilder api)
    {
        var speaker = api.MapGroup("/Speaker").WithTags("Speaker").AddEndpointFilter<PrivacyEndpointFilter>();
        speaker.MapGet("/Get", async (bool? onlyActive, HttpContext context, SpeakerService speakerService,
            IAuthorizationService authorizationService) =>
        {
            if (await context.HasAdministrativeReadAccessAsync(authorizationService))
            {
                return Results.Ok(await speakerService.GetAsync(onlyActive ?? false));
            }

            return Results.Ok((await speakerService.GetAsync(onlyActive: true)).Select(ToPublicSpeaker));
        }).AllowAnonymous();
        speaker.MapGet("/Get/{id}", async (Guid id, HttpContext context, SpeakerService speakerService,
            IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.HasAdministrativeReadAccessAsync(authorizationService);
            var item = await speakerService.GetAsync(id);
            if (item is null || (!isAdmin && !item.IsActive))
            {
                return Results.NotFound();
            }

            return isAdmin ? Results.Ok(item) : Results.Ok(ToPublicSpeaker(item));
        }).AllowAnonymous().WithName("SpeakerGetById");
        speaker.MapPost("/Post", async (WorkshopSpeaker newSpeaker, SpeakerService speakerService) =>
        {
            if (string.IsNullOrWhiteSpace(newSpeaker.Name))
            {
                return Results.BadRequest("A speaker name is required.");
            }
            if (!await speakerService.CreateAsync(newSpeaker))
            {
                return Results.Conflict(new { message = "A speaker with this full name already exists." });
            }

            return Results.CreatedAtRoute("SpeakerGetById", new { id = newSpeaker.WorkshopSpeakerId }, newSpeaker);
        }).RequireAuthorization();
        speaker.MapPut("/Update/{id}", async (Guid id, WorkshopSpeaker updatedSpeaker, SpeakerService speakerService) =>
        {
            var item = await speakerService.GetAsync(id);
            if (item is null)
            {
                return Results.NotFound();
            }
            updatedSpeaker.WorkshopSpeakerId = item.WorkshopSpeakerId;
            if (string.IsNullOrWhiteSpace(updatedSpeaker.Name))
            {
                return Results.BadRequest("A speaker name is required.");
            }
            if (!await speakerService.UpdateAsync(id, updatedSpeaker))
            {
                return Results.Conflict(new { message = "A speaker with this full name already exists." });
            }

            return Results.NoContent();
        }).RequireAuthorization();
        speaker.MapDelete("/Delete/{id}", async (Guid id, SpeakerService speakerService) =>
        {
            if (await speakerService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await speakerService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization();
        speaker.MapPost("/ReconcileDuplicates", async (SpeakerService speakerService) =>
            Results.Ok(new { removedSpeakers = await speakerService.ReconcileDuplicatesAsync() }))
            .RequireAuthorization();
        // Historical exports belong to the offline migration tool. Keep the route so old clients
        // receive an explicit response instead of accidentally invoking a data repair online.
        speaker.MapPost("/RepairLegacyTrackReferences", () => Results.StatusCode(StatusCodes.Status410Gone))
            .RequireAuthorization();
    }

    private static void MapTopMenuEndpoints(RouteGroupBuilder api)
    {
        var topMenu = api.MapGroup("/TopMenu").WithTags("Top menu");
        topMenu.MapGet("", async (bool? onlyActive, TopMenuService service, HttpContext context,
            IAuthorizationService authorization) => Results.Ok(await service.GetAsync(
                !await context.HasAdministrativeReadAccessAsync(authorization) || (onlyActive ?? false)))).AllowAnonymous();
        topMenu.MapGet("/{id}", async (Guid id, TopMenuService service, HttpContext context,
            IAuthorizationService authorization) =>
        {
            var item = await service.GetAsync(id);
            return item is not null && (item.IsActive || await context.HasAdministrativeReadAccessAsync(authorization))
                ? Results.Ok(item) : Results.NotFound();
        }).AllowAnonymous().WithName("TopMenuGetById");
        topMenu.MapPost("", async (TopMenu item, TopMenuService service) =>
        {
            item.TopMenuElementId = Guid.NewGuid();
            await service.CreateAsync(item);
            return Results.CreatedAtRoute("TopMenuGetById", new { id = item.TopMenuElementId }, item);
        }).RequireAuthorization();
        topMenu.MapPut("/{id}", async (Guid id, TopMenu updated, TopMenuService service) =>
        {
            var item = await service.GetAsync(id);
            if (item is null)
            {
                return Results.NotFound();
            }

            updated.TopMenuElementId = item.TopMenuElementId;
            await service.UpdateAsync(id, updated);
            return Results.NoContent();
        }).RequireAuthorization();
        topMenu.MapDelete("/{id}", async (Guid id, TopMenuService service) =>
        {
            if (await service.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await service.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void MapValuesEndpoints(RouteGroupBuilder api)
    {
        var values = api.MapGroup("/Values").WithTags("Values");
        values.MapGet("/ValuesPlain", () => Results.Ok(new[] { "plain1", "plain2" }))
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme });
        values.MapGet("/ValuesMfa", () => Results.Ok(new[] { "totp1", "totp2" }))
            .RequireAuthorization(new AuthorizeAttribute
            {
                Policy = "mfa",
                AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme,
            });
        values.MapGet("/ValuesHwk", () => Results.Ok(new[] { "key1", "key2" }))
            .RequireAuthorization(new AuthorizeAttribute
            {
                Policy = "hwk",
                AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme,
            });
        values.MapPost("/Post", ([FromBody] string value) => Results.NoContent())
            .RequireAuthorization();
        values.MapPut("/Put/{id}", (int id, [FromBody] string value) => Results.NoContent())
            .RequireAuthorization();
        values.MapDelete("/Delete/{id}", (int id) => Results.NoContent())
            .RequireAuthorization();
    }

    private static void MapVenueEndpoints(RouteGroupBuilder api)
    {
        var venue = api.MapGroup("/Venue").WithTags("Venue");
        venue.MapGet("", async (VenueService service) => Results.Ok(await service.GetAsync()));
        venue.MapGet("/{id}", async (Guid id, VenueService service) =>
            await service.GetAsync(id) is { } item ? Results.Ok(item) : Results.NotFound()).WithName("VenueGetById");
        venue.MapPost("", async (Venue item, VenueService service) =>
        {
            item.VenueId = Guid.NewGuid();
            await service.CreateAsync(item);
            return Results.CreatedAtRoute("VenueGetById", new { id = item.VenueId }, item);
        }).RequireAuthorization();
        venue.MapPut("/{id}", async (Guid id, Venue updated, VenueService service) =>
        {
            var item = await service.GetAsync(id);
            if (item is null)
            {
                return Results.NotFound();
            }

            updated.VenueId = item.VenueId;
            await service.UpdateAsync(id, updated);
            return Results.NoContent();
        }).RequireAuthorization();
        venue.MapDelete("/{id}", async (Guid id, VenueService service) =>
        {
            if (await service.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await service.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void MapWeatherForecastEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/WeatherForecast", () =>
            Enumerable.Range(1, 5).Select(index => new WeatherForecast
            {
                Date = DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                TemperatureC = Random.Shared.Next(-20, 55),
                Summary = _weatherSummaries[Random.Shared.Next(_weatherSummaries.Length)],
            }).ToArray()).WithTags("WeatherForecast").WithName("GetWeatherForecast");
    }

    private static void MapWorkshopEndpoints(RouteGroupBuilder api)
    {
        var workshop = api.MapGroup("/Workshop").WithTags("Workshop");
        workshop.MapPut("/Publication/{id:guid}", async (Guid id, EventPublicationRequest request,
            WorkshopService service) =>
        {
            var item = await service.GetAsync(id);
            if (item is null) return Results.NotFound();
            if (request.Published && item.EventDate is null)
                return Results.Problem(statusCode: 400, title: "Event date required",
                    extensions: new Dictionary<string, object?> { ["code"] = "event_date_required" });
            item.Published = request.Published;
            await service.UpdateAsync(id, item);
            return Results.NoContent();
        });
        workshop.MapPut("/Homepage/{id:guid}", async (Guid id, HomepageSelectionRequest request,
            HttpContext context, WorkshopService service, TimeProvider clock, IConfiguration configuration) =>
        {
            var item = await service.GetAsync(id);
            if (item is null) return Results.NotFound();
            var zone = TimeZoneInfo.FindSystemTimeZoneById(configuration["Authorization:EventTimeZoneId"] ?? "Europe/Rome");
            if (request.Selected)
            {
                foreach (var selected in (await service.GetAsync()).Where(value => value.In_homepage))
                    if (EventPeriod.IsPast(selected, clock, zone))
                        await PermissionOperationFilter.RequireAsync(context, "events.past.manage");
                await service.ClearAllHomepageAsync();
            }
            item.In_homepage = request.Selected;
            await service.UpdateAsync(id, item);
            return Results.NoContent();
        });
        workshop.MapGet("/Get", async (bool? onlyPublished, HttpContext context, WorkshopService workshopService,
            SpeakerService speakerService, WorkshopFileService workshopFileService, IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.HasAdministrativeReadAccessAsync(authorizationService);
            var page = CollectionWindow.From(context);
            var items = await workshopService.GetAsync((onlyPublished ?? false) || !isAdmin, page);
            var speakers = items.Any(item => item.Tracks is { Count: > 0 }) ? await speakerService.GetAsync() : [];
            var files = (await workshopFileService.GetForWorkshopsAsync(items.Select(item => item.WorkshopId)))
                .ToLookup(file => file.WorkshopId);
            foreach (var item in items)
            {
                AddWorkshopSpeakers(item, speakers);
                await speakerService.ApplyTalkPhotosAsync(item);
                AddWorkshopFiles(item, files[item.WorkshopId]);
            }
            page?.WriteHeaders(context);
            return isAdmin ? Results.Ok(items) : Results.Ok(items.Select(PublicWorkshopProjection.From));
        }).AllowAnonymous();
        workshop.MapGet("/Get/{id}", async (Guid id, HttpContext context, WorkshopService workshopService,
            SpeakerService speakerService, WorkshopFileService workshopFileService, IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.HasAdministrativeReadAccessAsync(authorizationService);
            var item = await workshopService.GetAsync(id);
            if (item is null || (!isAdmin && item.Published != true))
            {
                return Results.NotFound();
            }
            await AddWorkshopSpeakers(item, speakerService);
            await AddWorkshopFiles(item, workshopFileService);
            return isAdmin ? Results.Ok(item) : Results.Ok(PublicWorkshopProjection.From(item));
        }).AllowAnonymous().WithName("WorkshopGetById");
        workshop.MapGet("/GetInHomePage/HomePage", async (WorkshopService workshopService, SpeakerService speakerService,
            WorkshopFileService workshopFileService) =>
        {
            var item = await workshopService.GetInHomePageAsync();
            if (item is null)
            {
                return Results.NotFound();
            }
            await AddWorkshopSpeakers(item, speakerService);
            await AddWorkshopFiles(item, workshopFileService);
            return Results.Ok(PublicWorkshopProjection.From(item));
        }).AllowAnonymous();
        workshop.MapGet("/GetByYear/{year}", async (int year, WorkshopService workshopService, SpeakerService speakerService, HttpContext context) =>
        {
            if (year is < 1900 or > 9998) return Results.BadRequest("Anno non valido.");
            var page = CollectionWindow.From(context);
            var items = await workshopService.GetByYearAsync(year, page);
            var speakers = await speakerService.GetAsync();
            foreach (var item in items)
            {
                AddWorkshopSpeakers(item, speakers);
                await speakerService.ApplyTalkPhotosAsync(item);
            }
            page?.WriteHeaders(context);
            return Results.Ok(items.Select(PublicWorkshopProjection.From));
        }).AllowAnonymous();
        workshop.MapPost("/Post", async (Workshop newWorkshop, WorkshopService workshopService,
            CounterService counterService, WebsiteStoragePaths storagePaths) =>
        {
            var input = newWorkshop;
            newWorkshop = new Workshop();
            WorkshopEditorInput.Apply(newWorkshop, input);
            newWorkshop.WorkshopId = Guid.NewGuid();
            var counter = await counterService.GetOrCreateWorkshopCounterAsync();
            var number = await counterService.ReserveNextWorkshopNumberAsync(counter.CounterId);
            var folderName = $"workshop{number:000}";
            var contentsPath = storagePaths.ContentsRoot;
            var workshopPath = Path.Combine(contentsPath, "workshops", folderName);
            while (Directory.Exists(workshopPath))
            {
                number = await counterService.ReserveNextWorkshopNumberAsync(counter.CounterId);
                folderName = $"workshop{number:000}";
                workshopPath = Path.Combine(contentsPath, "workshops", folderName);
            }
            newWorkshop.FolderName = folderName;
            Directory.CreateDirectory(workshopPath);
            Directory.CreateDirectory(Path.Combine(workshopPath, "photos"));
            Directory.CreateDirectory(Path.Combine(workshopPath, "tracks"));
            newWorkshop.Image = $"/workshops/{folderName}/workshop.png";
            newWorkshop.ImageThumbnail = $"/workshops/{folderName}/workshop_thumb.png";
            newWorkshop.CreationDate = DateTime.Now;
            newWorkshop.Published = false;
            foreach (var track in newWorkshop.Tracks ?? [])
            {
                if (track.WorkshopTrackId == Guid.Empty)
                {
                    track.WorkshopTrackId = Guid.NewGuid();
                }
            }
            EnsureAgendaIds(newWorkshop);
            if (newWorkshop.In_homepage)
            {
                await workshopService.ClearAllHomepageAsync();
            }
            await workshopService.CreateAsync(newWorkshop);
            return Results.CreatedAtRoute("WorkshopGetById", new { id = newWorkshop.WorkshopId }, newWorkshop);
        }).RequireAuthorization();
        workshop.MapPost("/PreviewSessionize/{id}", async (Guid id, SessionizeImportRequest request,
            WorkshopService workshopService, SpeakerService speakerService, SessionizeImportService importer,
            CancellationToken cancellationToken) =>
        {
            if (await workshopService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            var import = await ImportSessionize(request, importer, cancellationToken);
            if (import.Error is not null)
            {
                return import.Error;
            }
            return Results.Ok(await speakerService.GetSessionizeCollisionsAsync(import.Value!.Speakers));
        }).RequireAuthorization();
        workshop.MapPost("/ImportSessionize/{id}", async (Guid id, SessionizeImportRequest request,
            WorkshopService workshopService, SpeakerService speakerService, SessionizeImportService importer,
            CancellationToken cancellationToken) =>
        {
            var item = await workshopService.GetAsync(id);
            if (item is null)
            {
                return Results.NotFound();
            }
            var import = await ImportSessionize(request, importer, cancellationToken);
            if (import.Error is not null)
            {
                return import.Error;
            }
            var data = import.Value!;
            var collisions = await speakerService.GetSessionizeCollisionsAsync(data.Speakers);
            var decisions = request.SpeakerOverwriteDecisions ?? [];
            if (collisions.Any(collision => !decisions.ContainsKey(collision.SessionizeId)))
            {
                return Results.Conflict(collisions);
            }
            List<WorkshopSpeaker> imported;
            try
            {
                imported = await speakerService.UpsertSessionizeAsync(data.Speakers, decisions);
            }
            catch (UnresolvedSpeakerCollisionException)
            {
                return Results.Conflict(await speakerService.GetSessionizeCollisionsAsync(data.Speakers));
            }
            var bySessionizeId = imported
                .Where(speaker => speaker.SessionizeId is not null)
                .ToDictionary(speaker => speaker.SessionizeId!, StringComparer.Ordinal);
            foreach (var speaker in data.Talks.SelectMany(talk => talk.Speakers))
            {
                if (speaker.SessionizeId is not null && bySessionizeId.TryGetValue(speaker.SessionizeId, out var saved))
                {
                    speaker.WorkshopSpeakerId = saved.WorkshopSpeakerId;
                    speaker.Name = saved.Name;
                    speaker.ImageUrl = saved.ProfileImageUrl;
                    speaker.Biography = saved.Description;
                }
            }
            item.Talks = WorkshopTalkImportMerger.Merge(item.Talks ?? [], data.Talks);
            await workshopService.UpdateAsync(id, item);
            return Results.Ok(new { importedTalks = data.Talks.Count, importedSpeakers = imported.Count });
        }).RequireAuthorization();
        workshop.MapPut("/Update/{id}", async (Guid id, Workshop updated, WorkshopService workshopService) =>
        {
            var current = await workshopService.GetAsync(id);
            if (current is null)
            {
                return Results.NotFound();
            }
            if (updated.EventbriteTicketCapacity < current.EventbriteSyncedTicketCapacity)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Eventbrite ticket capacity cannot be reduced",
                    Detail = $"Increase the desired total to at least {current.EventbriteSyncedTicketCapacity}; sold tickets are not released by this integration.",
                    Status = StatusCodes.Status400BadRequest,
                });
            }
            WorkshopEditorInput.Apply(current, updated);
            updated = current;
            if (!string.IsNullOrWhiteSpace(current.EventbriteEventId))
            {
                updated.EventbriteSyncStatus = "update-pending";
                updated.EventbriteLastError = null;
            }
            EnsureAgendaIds(updated);
            foreach (var track in updated.Tracks ?? [])
            {
                if (track.WorkshopTrackId == Guid.Empty)
                {
                    track.WorkshopTrackId = Guid.NewGuid();
                }
            }
            if (updated.In_homepage)
            {
                await workshopService.ClearAllHomepageAsync();
            }
            await workshopService.UpdateAsync(id, updated);
            if (!string.IsNullOrWhiteSpace(updated.EventbriteEventId))
            {
                await workshopService.UpdateEventbriteAsync(updated);
            }
            return Results.NoContent();
        }).RequireAuthorization();
        workshop.MapDelete("/Delete/{id}", async (Guid id, WorkshopService workshopService) =>
        {
            if (await workshopService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await workshopService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static void MapWorkshopFileEndpoints(RouteGroupBuilder api)
    {
        var workshopFile = api.MapGroup("/WorkshopFile").WithTags("Workshop file");
        workshopFile.MapGet("/Download/{id:guid}", async (Guid id, HttpContext context,
            WorkshopFileService files, WorkshopService workshops, WorkshopAssetStorage storage,
            IAuthorizationService authorization) =>
        {
            var file = await files.GetFileAsync(id);
            if (file is null || file.FullPath != $"/api/WorkshopFile/Download/{id:D}")
                return Results.NotFound();
            var workshop = await workshops.GetAsync(file.WorkshopId);
            if (workshop is null || (workshop.Published != true && !await context.HasAdministrativeReadAccessAsync(authorization)))
                return Results.NotFound();
            var path = storage.PathFor(file);
            if (!File.Exists(path)) return Results.NotFound();
            var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            var contentType = provider.TryGetContentType(path, out var mime) ? mime : "application/octet-stream";
            return Results.File(path, contentType,
                fileDownloadName: file.FileType is WorkshopFileTypeEnum.Image or WorkshopFileTypeEnum.Photo
                    ? null : file.FileName, enableRangeProcessing: true);
        }).AllowAnonymous();
        workshopFile.MapGet("/{workshopId}", async (Guid workshopId, HttpContext context, WorkshopService workshopService,
            WorkshopFileService workshopFileService, IAuthorizationService authorizationService) =>
        {
            if (workshopId == Guid.Empty)
            {
                return Results.BadRequest("Workshop ID is required.");
            }
            var workshop = await workshopService.GetAsync(workshopId);
            if (workshop is null)
            {
                return Results.NotFound();
            }
            if (!await context.HasAdministrativeReadAccessAsync(authorizationService) && workshop.Published != true)
            {
                return Results.NotFound();
            }
            return Results.Ok(await workshopFileService.GetAsync(workshopId));
        }).AllowAnonymous();
        workshopFile.MapPost("/UploadWorkshopImage", async (IFormFile file, [FromForm] Guid workshopId,
            WorkshopService workshopService, WorkshopFileService files, WorkshopAssetStorage storage,
            CancellationToken cancellationToken) =>
        {
            if (file is null || file.Length == 0)
            {
                return Results.BadRequest("No file uploaded.");
            }
            if (workshopId == Guid.Empty)
            {
                return Results.BadRequest("Workshop ID is required.");
            }
            var workshop = await workshopService.GetAsync(workshopId);
            if (workshop is null)
            {
                return Results.NotFound("Workshop not found.");
            }
            if (string.IsNullOrEmpty(workshop.FolderName))
            {
                return Results.BadRequest("Workshop folder name is not set.");
            }
            if (!WorkshopUploadValidation.TryGetSafeExtension(file.FileName, WorkshopFileTypeEnum.Image, out var extension))
            {
                return Results.BadRequest("Only JPEG, PNG, WebP, and GIF images are allowed.");
            }
            var id = Guid.NewGuid();
            var fileName = $"{id:N}{extension}";
            var relativePath = $"/api/WorkshopFile/Download/{id:D}";
            var asset = new WorkshopFile
            {
                WorkshopFileId = id, WorkshopId = workshopId, FileName = fileName, FullPath = relativePath,
                FileType = WorkshopFileTypeEnum.Image, Title = "Workshop image",
            };
            if (!await storage.SaveAsync(file, asset, cancellationToken))
                return Results.BadRequest("File content or size is not permitted.");
            try { await files.CreateAsync(asset); }
            catch { File.Delete(storage.PathFor(asset)); throw; }
            await workshopService.UpdateImageAsync(workshopId, relativePath);
            return Results.Ok(new { fileName, filePath = relativePath, workshopId });
        }).DisableAntiforgery().RequireAuthorization();
        workshopFile.MapPost("/Upload", async (IFormFile file, [FromForm] Guid workshopId, [FromForm] int fileType,
            [FromForm] string? title, WorkshopService workshopService, WorkshopFileService workshopFileService,
            WorkshopAssetStorage storage, CancellationToken cancellationToken) =>
        {
            if (file is null || file.Length == 0)
            {
                return Results.BadRequest("No file uploaded.");
            }
            if (workshopId == Guid.Empty)
            {
                return Results.BadRequest("Workshop ID is required.");
            }
            var workshop = await workshopService.GetAsync(workshopId);
            if (workshop is null)
            {
                return Results.NotFound("Workshop not found.");
            }
            if (string.IsNullOrEmpty(workshop.FolderName))
            {
                return Results.BadRequest("Workshop folder name is not set.");
            }
            if (!Enum.IsDefined((WorkshopFileTypeEnum)fileType) ||
                !WorkshopUploadValidation.TryGetSafeExtension(file.FileName, (WorkshopFileTypeEnum)fileType, out var extension))
            {
                return Results.BadRequest("The file type or extension is not allowed.");
            }
            var id = Guid.NewGuid();
            var relativePath = $"/api/WorkshopFile/Download/{id:D}";
            var fileName = $"{id:N}{extension}";
            var item = new WorkshopFile
            {
                WorkshopFileId = id,
                WorkshopId = workshopId,
                Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title,
                FileName = fileName,
                FullPath = relativePath,
                FileType = (WorkshopFileTypeEnum)fileType,
            };
            if (!await storage.SaveAsync(file, item, cancellationToken))
                return Results.BadRequest("File content or size is not permitted. Office archives require a scanning integration.");
            try { await workshopFileService.CreateAsync(item); }
            catch { File.Delete(storage.PathFor(item)); throw; }
            return Results.Ok(new
            {
                fileName,
                filePath = relativePath,
                workshopId,
                fileType,
                workshopFileId = item.WorkshopFileId,
            });
        }).DisableAntiforgery().RequireAuthorization();
        workshopFile.MapDelete("/{workshopFileId}", async (Guid workshopFileId, WorkshopFileService workshopFileService,
            WebsiteStoragePaths storagePaths, WorkshopAssetStorage storage) =>
        {
            if (workshopFileId == Guid.Empty)
            {
                return Results.BadRequest("WorkshopFile ID is required.");
            }
            var item = await workshopFileService.GetFileAsync(workshopFileId);
            if (item is null)
            {
                return Results.NotFound("WorkshopFile not found.");
            }
            if (item.FullPath == $"/api/WorkshopFile/Download/{item.WorkshopFileId:D}")
            {
                var path = storage.PathFor(item);
                if (File.Exists(path)) File.Delete(path);
            }
            else if (!string.IsNullOrEmpty(item.FullPath))
            {
                var contentsPath = storagePaths.ContentsRoot;
                var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
                var relativePath = item.FullPath.TrimStart('/', '\\').Replace('/', Path.DirectorySeparatorChar);
                var physicalPath = Path.GetFullPath(Path.Combine(contentsPath, relativePath));
                if (!IsPathWithinDirectory(workshopsPath, physicalPath))
                {
                    return Results.BadRequest("Workshop file path is invalid.");
                }
                if (File.Exists(physicalPath))
                {
                    File.Delete(physicalPath);
                }
            }
            await workshopFileService.DeleteAsync(workshopFileId);
            return Results.NoContent();
        }).RequireAuthorization();
    }

    private static async Task<(SessionizeImportData? Value, IResult? Error)> ImportSessionize(
        SessionizeImportRequest request,
        SessionizeImportService importer,
        CancellationToken cancellationToken)
    {
        try
        {
            return (await importer.ImportAsync(request.SessionizeId, cancellationToken), null);
        }
        catch (ArgumentException exception)
        {
            return (null, Results.BadRequest(new ProblemDetails
            {
                Title = "Invalid Sessionize URL",
                Detail = exception.Message,
                Status = StatusCodes.Status400BadRequest,
            }));
        }
        catch (HttpRequestException)
        {
            return (null, Results.Problem(
                "Sessionize could not be reached or returned an unsuccessful response.",
                statusCode: StatusCodes.Status502BadGateway,
                title: "Sessionize import failed"));
        }
        catch (System.Text.Json.JsonException)
        {
            return (null, Results.Problem(
                "Sessionize returned data that could not be read.",
                statusCode: StatusCodes.Status502BadGateway,
                title: "Sessionize import failed"));
        }
    }

    private static async Task AddWorkshopFiles(Workshop workshop, WorkshopFileService service)
    {
        AddWorkshopFiles(workshop, await service.GetAsync(workshop.WorkshopId));
    }

    private static void AddWorkshopFiles(Workshop workshop, IEnumerable<WorkshopFile> files)
    {
        foreach (var file in files)
        {
            if (file.FileType == WorkshopFileTypeEnum.Photo)
            {
                workshop.Photos ??= [];
                workshop.Photos.Add(file);
            }
            if (file.FileType == WorkshopFileTypeEnum.Material)
            {
                workshop.Materials ??= [];
                workshop.Materials.Add(file);
            }
        }
    }

    private static async Task AddWorkshopSpeakers(Workshop workshop, SpeakerService service)
    {
        AddWorkshopSpeakers(workshop, await service.GetAsync());
        await service.ApplyTalkPhotosAsync(workshop);
    }

    private static void AddWorkshopSpeakers(Workshop workshop, IReadOnlyCollection<WorkshopSpeaker> speakers)
    {
        var byId = speakers.ToDictionary(x => x.WorkshopSpeakerId);
        foreach (var snapshot in (workshop.Talks ?? []).SelectMany(x => x.Speakers ?? []))
            if (snapshot.WorkshopSpeakerId is Guid id && byId.TryGetValue(id, out var current) && current.PhotoFallbackDisabled)
            {
                snapshot.ImageUrl = current.ProfileImageUrl;
                snapshot.PhotoFallbackDisabled = true;
            }
        foreach (var track in workshop.Tracks ?? [])
        {
            if (track.Speakers is not { Count: > 0 })
            {
                continue;
            }
            var details = speakers.Where(speaker => track.Speakers.Contains(speaker.WorkshopSpeakerId))
                .Select(speaker => speaker.Name).Where(name => name != null).Cast<string>().ToList();
            track.SpeakersDetails = details;
            track.SpeakersName = string.Join(", ", details);
        }
    }

    private static void EnsureAgendaIds(Workshop workshop)
    {
        workshop.Talks ??= [];
        foreach (var talk in workshop.Talks)
        {
            if (talk.WorkshopTalkId == Guid.Empty)
            {
                talk.WorkshopTalkId = Guid.NewGuid();
            }
            talk.Speakers ??= [];
            foreach (var speaker in talk.Speakers)
            {
                if (speaker.WorkshopSpeakerId is not Guid speakerId || speakerId == Guid.Empty)
                {
                    speaker.WorkshopSpeakerId = Guid.NewGuid();
                }
            }
        }
        workshop.AgendaTracks ??= [];
        foreach (var track in workshop.AgendaTracks)
        {
            if (track.WorkshopAgendaTrackId == Guid.Empty)
            {
                track.WorkshopAgendaTrackId = Guid.NewGuid();
            }
        }
        workshop.AgendaItems ??= [];
        foreach (var item in workshop.AgendaItems)
        {
            if (item.WorkshopAgendaItemId == Guid.Empty)
            {
                item.WorkshopAgendaItemId = Guid.NewGuid();
            }
        }
    }

    private static bool IsPathWithinDirectory(string directory, string path)
    {
        var relativePath = Path.GetRelativePath(directory, path);
        return !Path.IsPathRooted(relativePath) &&
            relativePath != "." &&
            relativePath != ".." &&
            !relativePath.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal) &&
            !relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}", StringComparison.Ordinal);
    }

    private static object ToPublicBoard(Board board) => new
    {
        board.BoardId,
        board.Name,
        board.Description,
        board.ProfileImageUrl,
        board.PhotoFallbackDisabled,
        board.BlogHtml,
        board.LInkedinUrl,
        board.TwitterUrl,
        board.GitHubUrl,
        board.FaceboookUrl,
        board.InstagramUrl,
        board.ShortBio,
        board.FullBio,
        board.IsActive,
        board.Order,
    };

    private static object ToPublicSpeaker(WorkshopSpeaker speaker) => new
    {
        speaker.WorkshopSpeakerId,
        speaker.Name,
        speaker.ProfileImageUrl,
        speaker.PhotoFallbackDisabled,
        speaker.IsActive,
        speaker.Description,
    };

    private static IResult InvalidGuid(string parameterName, string value) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [parameterName] = [$"The value '{value}' is not valid."],
        });

    private static string? CurrentUser(ClaimsPrincipal user) =>
        AccountIdentity.FromPrincipal(user) is { } account ? $"{account.Issuer}|{account.Subject}" : null;

    private static async Task AddSpeakerNames(Workshop workshop, SpeakerService speakerService)
    {
        if (workshop.Tracks is not { Count: > 0 })
        {
            return;
        }

        var speakers = await speakerService.GetAsync();
        foreach (var track in workshop.Tracks.Where(track =>
                     track.Speakers is { Count: > 0 } && string.IsNullOrWhiteSpace(track.SpeakersName)))
        {
            track.SpeakersName = string.Join(", ", speakers
                .Where(speaker => track.Speakers!.Contains(speaker.WorkshopSpeakerId) && speaker.Name != null)
                .Select(speaker => speaker.Name));
        }
    }
}
