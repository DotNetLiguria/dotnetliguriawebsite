using System.Text.Json;

using DotNetLiguria.Models;

using Microsoft.EntityFrameworkCore;

using MongoDB.Driver;

namespace DataMigration;

internal class Program
{
    static void Main(string[] args)
    {
        //var db = ConfigurationReader.Read<DbConfig>("DbConfig");
        //Console.WriteLine();

        //using var ctx = new DotNetLiguriaContext(db.ConnectionString);

        //var workshops = ctx.Workshops
        //    .OrderBy(w => w.EventDate)
        //    //.Include(w => w.WorkshopFiles)
        //    .ToList();
        //var workshopFiles = ctx.WorkshopFiles.OrderBy(w => w.FileName).ToList();
        //var workshopTracks = ctx.Tracks.OrderBy(w => w.WorkshopId).ToList();
        //var workshopSpeakers = ctx.Speakers.OrderBy(w => w.Name).ToList();

        JsonSerializerOptions options = new()
        {
            WriteIndented = true,

        };

        //var jsonWorkshops = JsonSerializer.Serialize(workshops, options);
        //var jsonWorkshopFiles = JsonSerializer.Serialize(workshopFiles, options);
        //var jsonWorkshopTracks = JsonSerializer.Serialize(workshopTracks, options);
        //var jsonWorkshopSpeakers = JsonSerializer.Serialize(workshopSpeakers, options);

        //File.WriteAllText("workshops.json", jsonWorkshops);
        //File.WriteAllText("workshopFiles.json", jsonWorkshopFiles);
        //File.WriteAllText("workshopTracks.json", jsonWorkshopTracks);
        //File.WriteAllText("workshopSpeakers.json", jsonWorkshopSpeakers);

        var envPath = Environment.CurrentDirectory;

        string jsonPath = Path.GetFullPath(Path.Combine(envPath, @"..\..\..\json\"));

        string fileName = jsonPath + "workshopSpeakers.json";
        string jsonString = File.ReadAllText(fileName);
        var speakers = JsonSerializer.Deserialize<List<DotNetLiguria.Models.WorkshopSpeaker>>(jsonString, options);
        if (speakers == null) throw new Exception("Cannot deserialize (result is null)");

        fileName = jsonPath + "workshops.json";
        jsonString = File.ReadAllText(fileName);
        var workshops = JsonSerializer.Deserialize<List<DotNetLiguria.Models.Workshop>>(jsonString, options);
        if (workshops == null) throw new Exception("Cannot deserialize (result is null)");

        var mongoDBDatabaseSettings = ConfigurationReader.Read<DotNetLiguriaDatabaseSettings>("DotNetLiguriaDatabase");

        if (mongoDBDatabaseSettings != null)
        {
            var mongoClient = new MongoClient(mongoDBDatabaseSettings.ConnectionString);

            var mongoDatabase = mongoClient.GetDatabase(mongoDBDatabaseSettings.DatabaseName);

            IMongoCollection<DotNetLiguria.MongoDBModel.WorkshopSpeaker> _speakerCollection = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.WorkshopSpeaker>(
                mongoDBDatabaseSettings.SpeakerCollectionName);

            foreach (var item in speakers)
            {
                var alreadyPresent = _speakerCollection.Find(x => x.WorkshopSpeakerId == item.WorkshopSpeakerId).FirstOrDefault();

                if (alreadyPresent == null)
                {
                    DotNetLiguria.MongoDBModel.WorkshopSpeaker speaker = new DotNetLiguria.MongoDBModel.WorkshopSpeaker();
                    speaker.WorkshopSpeakerId = item.WorkshopSpeakerId;
                    speaker.Name = item?.Name;
                    speaker.UserName = item?.UserName;
                    speaker.ProfileImage = item?.ProfileImage;
                    speaker.BlogHtml = item?.BlogHtml;

                    _speakerCollection.InsertOne(speaker);
                }
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.Workshop> _workshopCollection
                = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.Workshop>(mongoDBDatabaseSettings.WorkshopCollectionName);

            foreach (var item in workshops)
            {
                var alreadyPresent = _workshopCollection.Find(x => x.WorkshopId == item.WorkshopId).FirstOrDefault();

                if (alreadyPresent == null)
                {
                    DotNetLiguria.MongoDBModel.Workshop workshop = new DotNetLiguria.MongoDBModel.Workshop();
                    workshop.WorkshopId = item.WorkshopId;
                    workshop.Title = item.Title;
                    workshop.Description = item.Description;
                    workshop.Image = item.Image;
                    workshop.OnlyHtml = item.OnlyHtml;
                    workshop.BlogHtml = item.BlogHtml;
                    workshop.Published = item.Published;
                    workshop.CreationDate = item.CreationDate;
                    workshop.EventDate = item.EventDate;
                    workshop.IsExternalEvent = item.IsExternalEvent;
                    workshop.ExternalRegistration = item.ExternalRegistration;
                    workshop.ExternalRegistrationLink = item.ExternalRegistrationLink;
                    workshop.Tags = item.Tags;
                    workshop.Slug = "";
                    workshop.OldUrl = $"https://dotnetliguria.net/Workshops/Detail?WorkshopId={item.WorkshopId}";

                    if (item.Location != null)
                    {
                        workshop.Location = new DotNetLiguria.MongoDBModel.Location()
                        {
                            Address = item.Location.Address,
                            Coordinates = item.Location.Coordinates,
                            MaximumSpaces = item.Location.MaximumSpaces,
                            Name = item.Location.Name,
                        };
                    }

                    if (item.Tracks != null && item.Tracks.Count() > 0)
                    {
                        foreach (var track in item.Tracks)
                        {
                            workshop.Tracks?.Add(new DotNetLiguria.MongoDBModel.WorkshopTrack()
                            {
                                Title = track.Title,
                                Abstract = track.Abstract,
                                Image = track.Image,
                                Level = track.Level,
                                EndTime = track.EndTime,
                                StartTime = track.StartTime,
                                WorkshopTrackId = track.WorkshopTrackId,
                                Speakers = track.Speakers.Select(x => x.WorkshopSpeakerId).ToList(),
                            });
                        }
                    }

                    _workshopCollection.InsertOne(workshop);
                }
            }
        }

    }
}