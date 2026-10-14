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

namespace DotNetLiguriaCore.Endpoints;

public static class ApiEndpointMappings
{
    private static readonly string[] _weatherSummaries =
    [
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching",
    ];

    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api");
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
            .RequireAuthorization(BackupAuthorizationOptions.PolicyName);

        backup.MapGet("/snapshots", async (DatabaseBackupService backupService, CancellationToken cancellationToken) =>
            Results.Ok(await backupService.ListAsync(cancellationToken)));
        backup.MapPost("/export", async (DatabaseBackupService backupService, CancellationToken cancellationToken) =>
            Results.Ok(await backupService.CreateAsync(cancellationToken)));
        backup.MapPost("/import", async (
            BackupRestoreRequest request,
            DatabaseBackupService backupService,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
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
        var board = api.MapGroup("/Board").WithTags("Board");
        board.MapGet("/Get", async (bool? onlyActive, HttpContext context, BoardService boardService,
            IAuthorizationService authorizationService) =>
        {
            if (await context.IsWebDevAdminAsync(authorizationService))
            {
                return Results.Ok(await boardService.GetAsync(onlyActive ?? false));
            }

            var publicBoards = (await boardService.GetAsync(onlyActive: true)).Select(ToPublicBoard);
            return Results.Ok(publicBoards);
        }).AllowAnonymous();
        board.MapGet("/Get/{id}", async (Guid id, HttpContext context, BoardService boardService,
            IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.IsWebDevAdminAsync(authorizationService);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        board.MapDelete("/Delete/{id}", async (Guid id, BoardService boardService) =>
        {
            if (await boardService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }

            await boardService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        counter.MapPut("/Update/{id}", async (Guid id, Counter updatedCounter, CounterService counterService) =>
        {
            if (await counterService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }

            await counterService.UpdateAsync(id, updatedCounter);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
    }

    private static void MapEventbriteEndpoints(RouteGroupBuilder api)
    {
        var eventbrite = api.MapGroup("/Eventbrite").WithTags("Eventbrite")
            .RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
            .AllowAnonymous().RequireRateLimiting(PublicQuestionnaireRateLimit.PolicyName);
        questionnaire.MapGet("/{id:guid}", async (Guid id, QuestionnaireService service, CancellationToken cancellationToken) =>
            await service.GetPublicAsync(id, cancellationToken) is { } view ? Results.Ok(view) : Results.NotFound());
        questionnaire.MapGet("/by-workshop/{workshopId:guid}",
            async (Guid workshopId, QuestionnaireService service, CancellationToken cancellationToken) =>
                await service.GetPublicByWorkshopAsync(workshopId, cancellationToken) is { } view
                    ? Results.Ok(view) : Results.NotFound());
        questionnaire.MapPost("/{id:guid}/responses",
            async (Guid id, SubmitQuestionnaireResponseRequest request, QuestionnaireService service,
                CancellationToken cancellationToken) =>
                QuestionnaireActionResults.From(await service.SubmitAsync(id, request, cancellationToken),
                    responseId => Results.Ok(new { responseId })));
    }

    private static void MapQuestionnaireEndpoints(RouteGroupBuilder api)
    {
        var questionnaire = api.MapGroup("/Questionnaire").WithTags("Questionnaire")
            .RequireAuthorization(QuestionnaireAuthorizationOptions.PolicyName);
        questionnaire.MapGet("", async (QuestionnaireService service, WorkshopService workshopService,
            CancellationToken cancellationToken) =>
        {
            var summaries = await service.ListAsync(cancellationToken);
            if (summaries.Any(summary => summary.WorkshopId.HasValue))
            {
                var titles = (await workshopService.GetAllAsync()).GroupBy(workshop => workshop.WorkshopId)
                    .ToDictionary(group => group.Key, group => group.First().Title);
                foreach (var summary in summaries.Where(summary => summary.WorkshopId.HasValue))
                {
                    summary.WorkshopTitle = titles.GetValueOrDefault(summary.WorkshopId!.Value);
                }
            }

            return Results.Ok(summaries);
        });
        questionnaire.MapGet("/{id:guid}", async (Guid id, QuestionnaireService service, CancellationToken cancellationToken) =>
            await service.GetAsync(id, cancellationToken) is { } item ? Results.Ok(item) : Results.NotFound())
            .WithName("QuestionnaireGetById");
        questionnaire.MapGet("/by-workshop/{workshopId:guid}",
            async (Guid workshopId, QuestionnaireService service, CancellationToken cancellationToken) =>
                Results.Ok(await service.GetByWorkshopAsync(workshopId, cancellationToken)));
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
        questionnaire.MapGet("/{id:guid}/responses", async (Guid id, QuestionnaireService service,
            CancellationToken cancellationToken) =>
            await service.GetResponsesAsync(id, cancellationToken) is { } responses ? Results.Ok(responses) : Results.NotFound());
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
        var speaker = api.MapGroup("/Speaker").WithTags("Speaker");
        speaker.MapGet("/Get", async (bool? onlyActive, HttpContext context, SpeakerService speakerService,
            IAuthorizationService authorizationService) =>
        {
            if (await context.IsWebDevAdminAsync(authorizationService))
            {
                return Results.Ok(await speakerService.GetAsync(onlyActive ?? false));
            }

            return Results.Ok((await speakerService.GetAsync(onlyActive: true)).Select(ToPublicSpeaker));
        }).AllowAnonymous();
        speaker.MapGet("/Get/{id}", async (Guid id, HttpContext context, SpeakerService speakerService,
            IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.IsWebDevAdminAsync(authorizationService);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        speaker.MapDelete("/Delete/{id}", async (Guid id, SpeakerService speakerService) =>
        {
            if (await speakerService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await speakerService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        speaker.MapPost("/ReconcileDuplicates", async (SpeakerService speakerService) =>
            Results.Ok(new { removedSpeakers = await speakerService.ReconcileDuplicatesAsync() }))
            .RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        speaker.MapPost("/RepairLegacyTrackReferences", async (
            LegacySpeakerReferenceRepairService repairService,
            CancellationToken cancellationToken) =>
        {
            var result = await repairService.RepairAsync(cancellationToken);
            return Results.Ok(new
            {
                result.SafetySnapshotId,
                result.WorkshopsUpdated,
                result.ReferencesUpdated,
                result.UnmappedReferences,
            });
        }).RequireAuthorization(BackupAuthorizationOptions.PolicyName);
    }

    private static void MapTopMenuEndpoints(RouteGroupBuilder api)
    {
        var topMenu = api.MapGroup("/TopMenu").WithTags("Top menu");
        topMenu.MapGet("", async (bool? onlyActive, TopMenuService service) => Results.Ok(await service.GetAsync(onlyActive ?? false)));
        topMenu.MapGet("/{id}", async (Guid id, TopMenuService service) =>
            await service.GetAsync(id) is { } item ? Results.Ok(item) : Results.NotFound()).WithName("TopMenuGetById");
        topMenu.MapPost("", async (TopMenu item, TopMenuService service) =>
        {
            item.TopMenuElementId = Guid.NewGuid();
            await service.CreateAsync(item);
            return Results.CreatedAtRoute("TopMenuGetById", new { id = item.TopMenuElementId }, item);
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        topMenu.MapDelete("/{id}", async (Guid id, TopMenuService service) =>
        {
            if (await service.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await service.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
            .RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        values.MapPut("/Put/{id}", (int id, [FromBody] string value) => Results.NoContent())
            .RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        values.MapDelete("/Delete/{id}", (int id) => Results.NoContent())
            .RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        venue.MapDelete("/{id}", async (Guid id, VenueService service) =>
        {
            if (await service.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await service.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        workshop.MapGet("/Get", async (bool? onlyPublished, HttpContext context, WorkshopService workshopService,
            SpeakerService speakerService, WorkshopFileService workshopFileService, IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.IsWebDevAdminAsync(authorizationService);
            var items = await workshopService.GetAsync((onlyPublished ?? false) || !isAdmin);
            foreach (var item in items)
            {
                await AddWorkshopSpeakers(item, speakerService);
                await AddWorkshopFiles(item, workshopFileService);
            }
            return Results.Ok(items);
        }).AllowAnonymous();
        workshop.MapGet("/Get/{id}", async (Guid id, HttpContext context, WorkshopService workshopService,
            SpeakerService speakerService, WorkshopFileService workshopFileService, IAuthorizationService authorizationService) =>
        {
            var isAdmin = await context.IsWebDevAdminAsync(authorizationService);
            var item = await workshopService.GetAsync(id);
            if (item is null || (!isAdmin && item.Published != true))
            {
                return Results.NotFound();
            }
            await AddWorkshopSpeakers(item, speakerService);
            await AddWorkshopFiles(item, workshopFileService);
            return Results.Ok(item);
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
            return Results.Ok(item);
        }).AllowAnonymous();
        workshop.MapGet("/GetByYear/{year}", async (int year, WorkshopService workshopService) =>
            Results.Ok(await workshopService.GetByYearAsync(year))).AllowAnonymous();
        workshop.MapPost("/Post", async (Workshop newWorkshop, WorkshopService workshopService,
            CounterService counterService, IWebHostEnvironment environment) =>
        {
            newWorkshop.WorkshopId = Guid.NewGuid();
            var counter = await counterService.GetOrCreateWorkshopCounterAsync();
            var number = await counterService.ReserveNextWorkshopNumberAsync(counter.CounterId);
            var folderName = $"workshop{number:000}";
            var contentsPath = Path.Combine(environment.ContentRootPath, "Contents");
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
            updated.WorkshopId = current.WorkshopId;
            if (!string.IsNullOrWhiteSpace(current.EventbriteEventId))
            {
                CopyEventbriteState(current, updated);
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        workshop.MapDelete("/Delete/{id}", async (Guid id, WorkshopService workshopService) =>
        {
            if (await workshopService.GetAsync(id) is null)
            {
                return Results.NotFound();
            }
            await workshopService.RemoveAsync(id);
            return Results.NoContent();
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
    }

    private static void MapWorkshopFileEndpoints(RouteGroupBuilder api)
    {
        var workshopFile = api.MapGroup("/WorkshopFile").WithTags("Workshop file");
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
            if (!await context.IsWebDevAdminAsync(authorizationService) && workshop.Published != true)
            {
                return Results.NotFound();
            }
            return Results.Ok(await workshopFileService.GetAsync(workshopId));
        }).AllowAnonymous();
        workshopFile.MapPost("/UploadWorkshopImage", async (IFormFile file, [FromForm] Guid workshopId,
            WorkshopService workshopService, IWebHostEnvironment environment) =>
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
            var contentsPath = Path.Combine(environment.ContentRootPath, "Contents");
            var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
            var workshopPath = Path.GetFullPath(Path.Combine(workshopsPath, workshop.FolderName));
            if (!IsPathWithinDirectory(workshopsPath, workshopPath))
            {
                return Results.BadRequest("Workshop folder name is invalid.");
            }
            Directory.CreateDirectory(workshopPath);
            var fileName = $"workshop{extension}";
            await using (var stream = File.Create(Path.Combine(workshopPath, fileName)))
            {
                await file.CopyToAsync(stream);
            }
            var relativePath = $"/workshops/{workshop.FolderName}/{fileName}";
            await workshopService.UpdateImageAsync(workshopId, relativePath);
            return Results.Ok(new { fileName, filePath = relativePath, workshopId });
        }).DisableAntiforgery().RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        workshopFile.MapPost("/Upload", async (IFormFile file, [FromForm] Guid workshopId, [FromForm] int fileType,
            [FromForm] string? title, WorkshopService workshopService, WorkshopFileService workshopFileService,
            IWebHostEnvironment environment) =>
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
            var contentsPath = Path.Combine(environment.ContentRootPath, "Contents");
            var workshopsPath = Path.GetFullPath(Path.Combine(contentsPath, "workshops"));
            var workshopPath = Path.GetFullPath(Path.Combine(workshopsPath, workshop.FolderName));
            if (!IsPathWithinDirectory(workshopsPath, workshopPath))
            {
                return Results.BadRequest("Workshop folder name is invalid.");
            }
            Directory.CreateDirectory(workshopPath);
            var subFolder = (WorkshopFileTypeEnum)fileType switch
            {
                WorkshopFileTypeEnum.Photo => "photos",
                WorkshopFileTypeEnum.Material => "tracks",
                _ => string.Empty,
            };
            var targetPath = string.IsNullOrEmpty(subFolder) ? workshopPath : Path.Combine(workshopPath, subFolder);
            Directory.CreateDirectory(targetPath);
            var relativePath = string.IsNullOrEmpty(subFolder)
                ? $"/workshops/{workshop.FolderName}/{Guid.NewGuid():N}{extension}"
                : $"/workshops/{workshop.FolderName}/{subFolder}/{Guid.NewGuid():N}{extension}";
            var fileName = Path.GetFileName(relativePath);
            var filePath = Path.GetFullPath(Path.Combine(targetPath, fileName));
            if (!IsPathWithinDirectory(workshopsPath, filePath))
            {
                return Results.BadRequest("Upload path is invalid.");
            }
            await using (var stream = File.Create(filePath))
            {
                await file.CopyToAsync(stream);
            }
            var item = new WorkshopFile
            {
                WorkshopFileId = Guid.NewGuid(),
                WorkshopId = workshopId,
                Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title,
                FileName = fileName,
                FullPath = relativePath,
                FileType = (WorkshopFileTypeEnum)fileType,
            };
            await workshopFileService.CreateAsync(item);
            return Results.Ok(new
            {
                fileName,
                filePath = relativePath,
                workshopId,
                fileType,
                workshopFileId = item.WorkshopFileId,
            });
        }).DisableAntiforgery().RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
        workshopFile.MapDelete("/{workshopFileId}", async (Guid workshopFileId, WorkshopFileService workshopFileService,
            IWebHostEnvironment environment) =>
        {
            if (workshopFileId == Guid.Empty)
            {
                return Results.BadRequest("WorkshopFile ID is required.");
            }
            var item = (await workshopFileService.GetAsync()).FirstOrDefault(file => file.WorkshopFileId == workshopFileId);
            if (item is null)
            {
                return Results.NotFound("WorkshopFile not found.");
            }
            if (!string.IsNullOrEmpty(item.FullPath))
            {
                var contentsPath = Path.Combine(environment.ContentRootPath, "Contents");
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
        }).RequireAuthorization(WebDevAdminAuthorizationOptions.PolicyName);
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
        foreach (var file in await service.GetAsync(workshop.WorkshopId))
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
        var speakers = await service.GetAsync();
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

    private static void CopyEventbriteState(Workshop source, Workshop target)
    {
        target.EventbriteEventId = source.EventbriteEventId;
        target.EventbriteEventUrl = source.EventbriteEventUrl;
        target.EventbriteVenueId = source.EventbriteVenueId;
        target.EventbriteTicketClassId = source.EventbriteTicketClassId;
        target.EventbriteSyncedTicketCapacity = source.EventbriteSyncedTicketCapacity;
        target.EventbriteSyncStatus = source.EventbriteSyncStatus;
        target.EventbriteLastError = source.EventbriteLastError;
        target.EventbriteLastSyncedAt = source.EventbriteLastSyncedAt;
        target.EventbritePublished = source.EventbritePublished;
        target.ExternalRegistrationLink = source.ExternalRegistrationLink;
        target.ExternalRegistration = source.ExternalRegistration;
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
        speaker.IsActive,
        speaker.Description,
    };

    private static IResult InvalidGuid(string parameterName, string value) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [parameterName] = [$"The value '{value}' is not valid."],
        });

    private static string? CurrentUser(ClaimsPrincipal user) =>
        user.FindFirst("preferred_username")?.Value ?? user.FindFirst("email")?.Value ?? user.Identity?.Name;

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
