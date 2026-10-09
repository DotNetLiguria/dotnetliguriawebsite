using BlazorAppTest.Shared;
using DotNetLiguria.ServiceDefaults;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace BlazorQuestionarioServer.Data;

public static class LocalDatabaseInitializer
{
    public static void ValidateTarget(string connectionString)
    {
        var connection = new SqlConnectionStringBuilder(connectionString);
        var server = connection.DataSource;
        if (server.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
            server = server[4..];
        var parts = server.Split(',');
        if (parts.Length != 2 || !int.TryParse(parts[1], out var port) || port is < 1 or > 65535
            || !(parts[0].Equals("localhost", StringComparison.OrdinalIgnoreCase)
                || parts[0] == "127.0.0.1" || parts[0] == "[::1]")
            || connection.InitialCatalog != "DotNetLiguriaAspireQuestionnaire"
            || connection.AttachDBFilename.Length != 0)
            throw new InvalidOperationException("Refusing to initialize a database outside the local Aspire SQL resource.");
    }

    public static Workshop CreateSampleWorkshop()
    {
        var workshop = new Workshop
        {
            WorkshopId = Guid.Parse("ad89b6a1-7b75-4531-8b13-0cc1c933cd01"),
            Title = "Local development workshop",
            Description = "Synthetic questionnaire sample",
            CreationDate = new DateTime(2026, 1, 1),
            EventDate = new DateTime(2026, 1, 1),
            BlogHtml = "", Image = "", Tags = "", ExternalRegistrationLink = "",
            Published = true,
            WorkshopTracks = new List<WorkshopTrack>()
        };
        var track = new WorkshopTrack
        {
            WorkshopTrackId = Guid.Parse("ad89b6a1-7b75-4531-8b13-0cc1c933cd02"),
            WorkshopId = workshop.WorkshopId, Workshop = workshop,
            Title = "Aspire local development", Image = "", Abstract = "", Level = 1,
            StartTime = new DateTime(2026, 1, 1, 10, 0, 0),
            EndTime = new DateTime(2026, 1, 1, 11, 0, 0),
            ListaWorkshopTrackWorkshopSpeaker = new List<WorkshopTrackWorkshopSpeaker>()
        };
        var speakerId = Guid.Parse("ad89b6a1-7b75-4531-8b13-0cc1c933cd03");
        track.ListaWorkshopTrackWorkshopSpeaker.Add(new WorkshopTrackWorkshopSpeaker
        {
            WorkshopTrackWorkshopTrackId = track.WorkshopTrackId,
            WorkshopTrackWorkshopTrack = track,
            WorkshopSpeakerWorkshopSpeakerId = speakerId,
            WorkshopSpeakerWorkshopSpeaker = new WorkshopSpeaker
            {
                WorkshopSpeakerId = speakerId, Name = "Sample speaker",
                ProfileImage = "", BlogHtml = "", UserName = "sample"
            }
        });
        workshop.WorkshopTracks.Add(track);
        return workshop;
    }

    public static async Task InitializeAsync(ApplicationDbContext context, IConfiguration configuration,
        IHostEnvironment environment, ILogger logger)
    {
        if (!LocalDevelopment.ShouldInitialize(configuration, environment))
            return;

        ValidateTarget(context.Database.GetConnectionString()
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required."));
        await context.Database.EnsureCreatedAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();
        if (!await context.Workshop.AnyAsync())
        {
            var workshop = CreateSampleWorkshop();
            context.Workshop.Add(workshop);
            if (!await context.WorkshopCorrente.AnyAsync())
                context.WorkshopCorrente.Add(new WorkshopCorrente { WorkshopId = workshop.WorkshopId });
            await context.SaveChangesAsync();
        }
        await transaction.CommitAsync();
        logger.LogInformation("Aspire local SQL questionnaire is initialized.");
    }
}
