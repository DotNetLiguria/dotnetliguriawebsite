using System.Text.Json;

using DotNetLiguria.Models;

using Microsoft.EntityFrameworkCore;

using MongoDB.Driver;

namespace DataMigration;

internal class Program
{
    static void Main(string[] args)
    {
        DotNetLiguriaCore.Model.BsonCompatibility.Configure();
        if (Questionnaires.QuestionnaireMigrationOptions.IsQuestionnaireCommand(args))
        {
            RunQuestionnaireMigration(args);
            return;
        }

        JsonSerializerOptions options = new()
        {
            WriteIndented = true,

        };

        // --from-json imports the checked-in json/ export without reading the historical SQL database.
        if (!args.Contains("--from-json", StringComparer.OrdinalIgnoreCase))
        {
            ReadFromSql(options);
        }

        ImportJsonIntoMongo(options);
    }

    private static void ReadFromSql(JsonSerializerOptions options)
    {
        var db = ConfigurationReader.Read<DbConfig>("DbConfig");
        Console.WriteLine();

        using var ctx = new DotNetLiguriaContext(db!.ConnectionString!);
        if (ctx.Workshops == null || ctx.Tracks == null || ctx.Speakers == null)
        {
            throw new Exception("Cannot read from SQL database. One or more tables are missing.");
        }

        var workshops = ctx.Workshops
           .OrderBy(w => w.EventDate)
           .Include(w => w.Location)
           .Include(w => w.Tracks!)
             .ThenInclude(w => w.Speakers)
           .ToList();

        var workshopTracks = ctx.Tracks!.OrderBy(w => w.WorkshopId).ToList();
        var workshopSpeakers = ctx.Speakers!.OrderBy(w => w.Name).ToList();

        //I need to create a dto for workshop and extract only speackers ids
        foreach (var workshop in workshops)
        {
            if (workshop.Tracks != null)
            {
                foreach (var track in workshop.Tracks)
                {
                    if (track.Speakers != null)
                    {
                        track.Speakers = [.. track.Speakers.Select(s => new WorkshopSpeaker
                        {
                            WorkshopSpeakerId = s.WorkshopSpeakerId,
                            Name = s.Name,
                            ProfileImage = s.ProfileImage,
                            BlogHtml = s.BlogHtml,
                            UserName = s.UserName
                        })];
                    }
                }
            }
        }

        //I need to serialize into json folder
        var destinationJsonPath = Path.Combine(Environment.CurrentDirectory, "json");
        if (!Directory.Exists(destinationJsonPath))
        {
            Directory.CreateDirectory(destinationJsonPath);
        }

        var jsonWorkshops = JsonSerializer.Serialize(workshops, options);
        var jsonWorkshopTracks = JsonSerializer.Serialize(workshopTracks, options);
        var jsonWorkshopSpeakers = JsonSerializer.Serialize(workshopSpeakers, options);

        // I need to write the json files
        // File.WriteAllText(Path.Combine(destinationJsonPath, "workshops.json"), jsonWorkshops);
        // File.WriteAllText(Path.Combine(destinationJsonPath, "workshopTracks.json"), jsonWorkshopTracks);
        // File.WriteAllText(Path.Combine(destinationJsonPath, "workshopSpeakers.json"), jsonWorkshopSpeakers);

        // //TOOD: END AT THIS POINT
        // return;
    }

    private static void ImportJsonIntoMongo(JsonSerializerOptions options)
    {
        var envPath = Environment.CurrentDirectory;

        string jsonPath = Path.GetFullPath(Path.Combine(envPath, "json\\"));

        string fileName = jsonPath + "workshopSpeakers.json";
        string jsonString = File.ReadAllText(fileName);
        var speakers = JsonSerializer.Deserialize<List<DotNetLiguria.Models.WorkshopSpeaker>>(jsonString, options) ?? throw new Exception("Cannot deserialize (result is null)");

        fileName = jsonPath + "workshops.json";
        jsonString = File.ReadAllText(fileName);
        var workshops1 = JsonSerializer.Deserialize<List<DotNetLiguria.Models.Workshop>>(jsonString, options) ?? throw new Exception("Cannot deserialize (result is null)");

        fileName = jsonPath + "workshopFiles.json";
        jsonString = File.ReadAllText(fileName);
        var workshopFiles = JsonSerializer.Deserialize<List<DotNetLiguria.Models.WorkshopFile>>(jsonString, options) ?? throw new Exception("Cannot deserialize (result is null)");


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
                    DotNetLiguria.MongoDBModel.WorkshopSpeaker speaker = new DotNetLiguria.MongoDBModel.WorkshopSpeaker
                    {
                        WorkshopSpeakerId = item.WorkshopSpeakerId,
                        Name = item?.Name,
                        UserName = item?.UserName,
                        ProfileImage = item?.ProfileImage,
                        ProfileImageUrl = item?.ProfileImage,
                        BlogHtml = item?.BlogHtml,
                        IsActive = true
                    };

                    _speakerCollection.InsertOne(speaker);
                }
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.Board> _boardCollection
                = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.Board>(mongoDBDatabaseSettings.BoardCollectionName);

            if (_boardCollection.CountDocuments(_ => true) == 0)
            {
                var board = new List<DotNetLiguria.MongoDBModel.Board>
            {
                new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Raffaele Rialdi",
                    ProfileImageUrl ="profile/raffaele-rialdi.jpg",
                    Description = "Presidente",
                    FullBio ="Mi occupo professionalmente di sviluppo software dal 1987. Mi sono specializzato nelle tecnologie di sviluppo basaste su piattaforma Microsoft che nel 2003 mi ha riconosciuto il premio \"Most Valuable Professional\" grazie al quale posso rimanere in contatto con i team di sviluppo del campus a Redmond dove mi reco ogni anno. Quest'anno ho festeggiato il 9^ award MVP. Il mio lavoro consiste nel progettare, coordinare e realizzare software utilizzando le tecnologie che più amo come il Framework.NET, C#, C++ e più recentemente WinRT. Oltre a questo sono consulente, teacher in corsi e speaker in conferenze del settore."
                },
                new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Alessandro Gambaro",
                    ProfileImageUrl ="profile/alessandro-gambaro.jpg",
                    Description = "Vice Presidente",
                    FullBio ="Con la passione per l'informatica sin dal 1985 quando ero un bambino con il mio ZX Spectrum, sono tuttora entusiasta e appassionato di IT, laureato in ingegneria informatica nel 2000 a Genova ho avuto la possibilità di costruire i miei skills lavorando e studiando (nessuno nasce imparato dico io :) ) durante tutta la mia carriera lavorativa.Partito con il C++ ho poi lavorato diversi anni in ambiente Java (linguaggio che tuttora utilizzo anche se raramente), da qualche anno utilizzo C# .Net che reputo una ottima piattaforma, che mi appassione e mi stimola a creare architetture sempre più complete (a parer mio). Nel mio lavoro oltre che progettare, coordinare lo sviluppo del software mi occupo anche di Agile Development e Scrum."
                },
                   new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Marco D'Alessandro",
                    ProfileImageUrl ="profile/marco-dalessandro.jpg",
                    Description = "Consigliere, Tesoriere, Web Designer",
                    FullBio ="Sono nato e vivo a Genova. Sono un programmatore orientato principalmente su piattaforma Framework .Net della microsoft, C#, WinForm e Service, Web Service e Asp.net. Lavoro come Software Engineer/Architect presso Softeco Sismat."
                },
                new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Andrea Belloni",
                    ProfileImageUrl ="profile/andrea-belloni.jpg",
                    Description = "Consigliere",
                    FullBio ="Vivo e lavoro a Imperia come libero professionista, mi occupo di consulenza in ambito Microsoft.NET, C#, VB.Net, ASP.Net, WPF, WCF. Appassionato di architettura del software, di database (SQLServer) e accesso ai dati (EntityFramework, Linq2SQL, ADO.NET) … curo lo sviluppo del software per alcune società della zona. Il mio tempo libero... Famiglia e free climibing."
                },
                 new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Alessio Gogna",
                    ProfileImageUrl ="profile/alessio-gogna.jpg",
                    Description = "Consigliere",
                    FullBio ="Microsoft Professional Developer, consulente IT, appassionato di .NET Framework, nostalgico programmatore C++, novello agilista, sostenitore del Free Software e inguaribile nerd. La mia passione è programmare: ho iniziato a 8 anni con un C=64 e non mi sono ancora fermato. Oggi mi dedico soprattutto a tecnologie Web-Oriented basate su .Net Framework."
                },
                new() {
                    BoardId = Guid.NewGuid(),
                    Name = "Claudio Masieri",
                    ProfileImageUrl ="profile/claudio-masieri.jpg",
                    Description = "Consigliere",
                    FullBio ="Libero professionista, ho lavorato come consulente presso molte realtà Genovesi (Elsag, Costa, Selex, TSF...). Saltuariamente tengo qualche corso in ambito Microsoft.Net, c#, vb, asp.net, WCF e Workflow Foundation e talvolta scrivo qualche articolo per la Wrox, o su Codeproject."
                },
                new() { BoardId = Guid.NewGuid(),
                    Name = "Alberto Baroni",
                    ProfileImageUrl ="profile/alberto-baroni.jpg",
                    Description = "Consigliere",
                    FullBio ="Sono nato e vivo a Genova. Per 10 anni mi sono occupato di soluzioni IT in ambito energetico. Ho collaborato alla progettazione e realizzazione di alcune delle più importanti soluzioni informatiche utilizzate dagli Operatori Energetici. Dal 2013 sono co-fondatore di Sinergetica Srl società leader nelle soluzioni software per il mercato enegetico"
                },
                new() { BoardId = Guid.NewGuid(),
                    Name = "Andrea Sassetti",
                    ProfileImageUrl ="profile/andrea-sassetti.jpg",
                    Description = "Consigliere",
                    FullBio ="Laureato in Ingegneria Informatica presso l'Università degli studi di Genova nel 2008. Sin dal 2004 mi occupo della tecnologia Microsoft.NET. Sono Microsoft Professional Developer e lavoro come software engineer nel campo dell'automazione industriale. Utilizzo principalmente C# e quando c'è bisogno di scolpire il metallo C++ :). Appassionato di tutto quello che gravita intorno alle NUI."
                }
            };

                var order = 0;
                foreach (var item in board)
                {
                    item.IsActive = true;
                    item.Order = ++order;
                    var alreadyPresent = _boardCollection.Find(x => x.BoardId == item.BoardId).FirstOrDefault();

                    if (alreadyPresent == null)
                    {
                        _boardCollection.InsertOne(item);
                    }
                }
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.TopMenu> _topMenuCollection
                = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.TopMenu>(mongoDBDatabaseSettings.TopMenuCollectionName);

            // Same entries the SPA top bar falls back to when the menu cannot be loaded.
            if (_topMenuCollection.CountDocuments(_ => true) == 0)
            {
                var topMenu = new (string Name, string Url)[]
                {
                    ("Home", "/"),
                    (".NET Conf 2025", "/#evidence"),
                    ("Il Team", "/#team"),
                    ("Eventi passati", "/workshops"),
                };

                _topMenuCollection.InsertMany(topMenu.Select((item, index) => new DotNetLiguria.MongoDBModel.TopMenu
                {
                    TopMenuElementId = Guid.NewGuid(),
                    Name = item.Name,
                    Url = item.Url,
                    Order = index + 1,
                    IsActive = true
                }));
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.FileType> _workshopTrackCollection
                = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.FileType>(mongoDBDatabaseSettings.FileTypeCollectionName);

            var fileTypes = Enum.GetValues<WorkshopFileType>()
                .Cast<DotNetLiguria.Models.WorkshopFileType>()
                .Select(x => new DotNetLiguria.MongoDBModel.FileType
                {
                    FileTypeId = (int)x,
                    Name = x.ToString()
                }).ToList();

            foreach (var item in fileTypes)
            {
                var alreadyPresent = _workshopTrackCollection.Find(x => x.FileTypeId == item.FileTypeId).FirstOrDefault();

                if (alreadyPresent == null)
                {
                    _workshopTrackCollection.InsertOne(item);
                }
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.Workshop> _workshopCollection
                = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.Workshop>(mongoDBDatabaseSettings.WorkshopCollectionName);

            var number = 33;
            foreach (var item in workshops1)
            {
                var alreadyPresent = _workshopCollection.Find(x => x.WorkshopId == item.WorkshopId).FirstOrDefault();

                //create a number with 3 digits from number
                var workshopFolderName = $"workshop{number:000}";

                if (alreadyPresent == null)
                {
                    DotNetLiguria.MongoDBModel.Workshop workshop = new()
                    {
                        WorkshopId = item.WorkshopId,
                        Title = item.Title,
                        Description = item.Description,
                        ImageOld = item.Image,
                        FolderName = workshopFolderName,
                        Image = $"/workshops/{workshopFolderName}/workshop.png",
                        ImageThumbnail = $"/workshops/{workshopFolderName}/workshop_thumb.png",
                        OnlyHtml = item.OnlyHtml,
                        BlogHtml = item.BlogHtml,
                        Published = item.Published,
                        CreationDate = item.CreationDate,
                        EventDate = item.EventDate,
                        IsExternalEvent = item.IsExternalEvent,
                        ExternalRegistration = item.ExternalRegistration,
                        ExternalRegistrationLink = item.ExternalRegistrationLink,
                        Tags = item.Tags,
                        Slug = "",
                        OldUrl = $"https://dotnetliguria.net/Workshops/Detail?WorkshopId={item.WorkshopId}"
                    };

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

                    if (item.Tracks != null && item.Tracks.Count > 0)
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

                number++;
            }

            IMongoCollection<DotNetLiguria.MongoDBModel.WorkshopFile> _workshopFileCollection
              = mongoDatabase.GetCollection<DotNetLiguria.MongoDBModel.WorkshopFile>(mongoDBDatabaseSettings.WorkshopFileCollectionName);

            var allWorkshops = _workshopCollection.Find(_ => true).ToList();

            if (_workshopFileCollection.CountDocuments(_ => true) == 0)
            {
                foreach (var item in workshopFiles)
                {
                    var workshopId = allWorkshops.FirstOrDefault(w => w.FolderName == item.WorkshopFolder)?.WorkshopId ?? Guid.Empty;

                    // Console.WriteLine($"Processing WorkshopId: {workshopId}, FileName: {item.FileName}");
                    var destFolder = item.FileType switch
                    {
                        DotNetLiguria.Models.WorkshopFileType.Material => "tracks",
                        DotNetLiguria.Models.WorkshopFileType.Photo => "photos",
                        _ => "other"
                    };

                    var fullPath = $"/workshops/{item.WorkshopFolder}/{destFolder}/{item.FileName}";
                    DotNetLiguria.MongoDBModel.WorkshopFile workshopFile = new DotNetLiguria.MongoDBModel.WorkshopFile
                    {
                        WorkshopFileId = Guid.NewGuid(),
                        WorkshopId = workshopId,
                        Title = item.Title,
                        FileName = item.FileName,
                        FullPath = fullPath,
                        FileType = item.FileType ?? DotNetLiguria.Models.WorkshopFileType.Other
                    };

                    _workshopFileCollection.InsertOne(workshopFile);
                }
            }
        }


    }

    private static void RunQuestionnaireMigration(string[] args)
    {
        var settings = ConfigurationReader.Read<DotNetLiguriaDatabaseSettings>("DotNetLiguriaDatabase")
            ?? throw new InvalidOperationException("Sezione DotNetLiguriaDatabase mancante.");
        var options = Questionnaires.QuestionnaireMigrationOptions.Parse(args,
            ConfigurationReader.Configuration?["QuestionnaireMigration:SqlServerConnectionString"],
            ConfigurationReader.Configuration?["QuestionnaireMigration:SqliteConnectionString"]);
        var database = new MongoClient(settings.ConnectionString).GetDatabase(settings.DatabaseName);
        var runner = new Questionnaires.QuestionnaireMigrationRunner(database, settings, Console.Out);
        runner.RunAsync(options, DateTime.UtcNow).GetAwaiter().GetResult();
    }

}
