using System.Text.Json;

using Microsoft.EntityFrameworkCore;

namespace DataMigration;

internal class Program
{
    static void Main(string[] args)
    {
        var db = ConfigurationReader.Read<DbConfig>("DbConfig");
        Console.WriteLine();

        var mongoDB = ConfigurationReader.Read<DotNetLiguriaDatabaseSettings>("DotNetLiguriaDatabase");

        using var ctx = new DotNetLiguriaContext(db.ConnectionString);
        //foreach (var item in ctx.Workshops.OrderBy(w => w.EventDate).ToList())
        //{
        //    Console.WriteLine(item.Title);
        //}

        var workshops = ctx.Workshops
            .OrderBy(w => w.EventDate)
            //.Include(w => w.WorkshopFiles)
            .ToList();
        var workshopFiles = ctx.WorkshopFiles.OrderBy(w => w.FileName).ToList();
        var workshopTracks = ctx.Tracks.OrderBy(w => w.WorkshopId).ToList();
        var workshopSpeakers = ctx.Speakers.OrderBy(w => w.Name).ToList();

        JsonSerializerOptions options = new()
        {
            WriteIndented = true,
            
        };

        var jsonWorkshops = JsonSerializer.Serialize(workshops, options);
        var jsonWorkshopFiles = JsonSerializer.Serialize(workshopFiles, options);
        var jsonWorkshopTracks = JsonSerializer.Serialize(workshopTracks, options);
        var jsonWorkshopSpeakers = JsonSerializer.Serialize(workshopSpeakers, options);

        File.WriteAllText("workshops.json", jsonWorkshops);
        File.WriteAllText("workshopFiles.json", jsonWorkshopFiles);
        File.WriteAllText("workshopTracks.json", jsonWorkshopTracks);
        File.WriteAllText("workshopSpeakers.json", jsonWorkshopSpeakers);

    }
}