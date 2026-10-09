using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using BlazorAppTest.Shared;
using DotNetLiguria.ServiceDefaults;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BlazorAppTest.Server;

public static class LocalDatabaseInitializer
{
    public static void ValidateTarget(string connectionString, string dataDirectory)
    {
        if (string.IsNullOrWhiteSpace(dataDirectory) || !Path.IsPathFullyQualified(dataDirectory))
            throw new InvalidOperationException("LocalDevelopment:DataDirectory must be an absolute local path.");

        var expected = Path.GetFullPath(Path.Combine(dataDirectory, "questionnaire.db"));
        var connection = new SqliteConnectionStringBuilder(connectionString);
        if (!Path.IsPathFullyQualified(connection.DataSource)
            || !string.Equals(Path.GetFullPath(connection.DataSource), expected,
                OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)
            || connection.Mode is SqliteOpenMode.Memory or SqliteOpenMode.ReadOnly)
            throw new InvalidOperationException("Refusing to initialize SQLite outside the Aspire questionnaire file.");
    }

    public static Workshop CreateSampleWorkshop()
    {
        var workshop = new Workshop
        {
            WorkshopId = "aspire-local-workshop",
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
            WorkshopTrackId = "aspire-local-track",
            WorkshopId = workshop.WorkshopId, Workshop = workshop,
            Title = "Aspire local development", Image = "", Abstract = "", Level = 1,
            StartTime = new DateTime(2026, 1, 1, 10, 0, 0),
            EndTime = new DateTime(2026, 1, 1, 11, 0, 0),
            WorkshopTrackWorkshopSpeaker = new List<WorkshopTrackWorkshopSpeaker>()
        };
        track.WorkshopTrackWorkshopSpeaker.Add(new WorkshopTrackWorkshopSpeaker
        {
            WorkshopTrackWorkshopTrackId = track.WorkshopTrackId,
            WorkshopTrackWorkshopTrack = track,
            WorkshopSpeakerWorkshopSpeakerId = "aspire-local-speaker",
            WorkshopSpeakerWorkshopSpeaker = new WorkshopSpeaker
            {
                WorkshopSpeakerId = "aspire-local-speaker", Name = "Sample speaker",
                ProfileImage = "", BlogHtml = "", UserName = "sample"
            }
        });
        workshop.WorkshopTracks.Add(track);
        return workshop;
    }

    public static async Task InitializeAsync(ApplicationDbContexts context, IConfiguration configuration,
        IHostEnvironment environment, ILogger logger)
    {
        if (!LocalDevelopment.ShouldInitialize(configuration, environment))
            return;

        ValidateTarget(context.Database.GetConnectionString(), configuration["LocalDevelopment:DataDirectory"]);
        await context.Database.EnsureCreatedAsync();
        await using var transaction = await context.Database.BeginTransactionAsync();
        if (!await context.Workshop.AnyAsync())
        {
            context.Workshop.Add(CreateSampleWorkshop());
            await context.SaveChangesAsync();
        }
        await transaction.CommitAsync();
        logger.LogInformation("Aspire local SQLite questionnaire is initialized.");
    }
}
