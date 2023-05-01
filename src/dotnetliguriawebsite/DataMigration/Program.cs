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
    }
}