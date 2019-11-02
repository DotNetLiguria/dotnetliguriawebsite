using DotNetLiguria.Models;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Web.DAL
{
    public class TestFactory
    {
        UnitOfWork unitOfWork;

        public TestFactory()
        {
            unitOfWork = Repository.Utils.RepositoryFactory.Get<UnitOfWork>();
        }

        Guid RaffaeleRialdi;
        Guid Alessandro;
        Guid AndreaBelloni;
        Guid AlessioGogna;
        Guid ClaudioMasieri;
        Guid MarcoDalessandro;
        Guid AlbertoBaroni;
        Guid MarcoMinerva;
        Guid MarcoDalPino;
        Guid GuidoNoceti;

        public void CreateDefaultDatabase()
        {
            CreateSpeakerID();

            CreateSpeakers();

            CreateWorkshop();

            News();

            Blogs();

            HtmlSnippets();

            unitOfWork.Save();
        }

        public void News()
        {
            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "Windowsteca",
                Url = "http://www.windowsteca.net/feed/",
                Enable = false,
                Image = "http://cdn.marketplaceimages.windowsphone.com/v8/images/6fbfd3aa-f147-4a1b-b552-32c62f687afd?imageType=ws_icon_large",
                Tags = "Windows Phone"
            });

            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "Downloadblog",
                Url = "http://www.downloadblog.it/rss2.xml",
                Enable = false,
                Image = "http://viral.juliusdesign.net/downloadblog/includes/downloadblog_logo.gif",
                Tags = "Software"
            });

            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "Plaffo",
                Url = "http://www.plaffo.com/feed/",
                Enable = false,
                Image = "http://cdn.marketplaceimages.windowsphone.com/v8/images/502670ca-f8b9-4207-80ec-17d998c09fd2?imageType=ws_icon_large",
                Tags = "Windows Phone"
            });

            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "WebNews",
                Url = "http://www.html.it/rss/webnews_news.xml",
                Enable = false,
                Image = "http://tecnologia.tiscali.it/media/12/12/webnews.jpg_415368877.jpg",
                Tags = "Web"
            });

            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "Windows Blog Italia",
                Url = "http://blogs.windows.com/italy/feed/",
                Enable = true,
                Image = "http://cdn.marketplaceimages.windowsphone.com/v8/images/d486a62d-d88d-4b67-8ef9-08bdbdd0e05c?imageType=ws_icon_large",
                Tags = "Windows"
            });

            unitOfWork.NewsRepository.Insert(new News()
            {
                NewsId = Guid.NewGuid(),
                Title = "Windows Blog",
                Url = "http://blogs.windows.com/feed/",
                Enable = false,
                Image = "http://cdn.marketplaceimages.windowsphone.com/v8/images/d486a62d-d88d-4b67-8ef9-08bdbdd0e05c?imageType=ws_icon_large",
                Tags = "Windows"
            });

        }

        public void Blogs()
        {
            unitOfWork.BlogRepository.Insert(new Blog()
            {
                BlogId = Guid.NewGuid(),
                Title = "Aspitalia",
                Url = "http://feed.aspitalia.com/feed.xml",
                Enable = false,
                Image = "https://fbcdn-sphotos-b-a.akamaihd.net/hphotos-ak-xpf1/t31.0-8/c0.248.851.315/p851x315/469264_10150646205174674_628190605_o.jpg",
                Tags = "Developer"
            });

            unitOfWork.BlogRepository.Insert(new Blog()
            {
                BlogId = Guid.NewGuid(),
                Title = "Scott Hanselman's Blog",
                Url = "http://feeds.feedburner.com/ScottHanselman",
                Enable = true,
                Image = "https://pbs.twimg.com/profile_images/459455847165218816/I_sH-zvU.jpeg",
                Tags = "Developer"
            });

            unitOfWork.BlogRepository.Insert(new Blog()
            {
                BlogId = Guid.NewGuid(),
                Title = "Jerry Nixon's Blog",
                Url = "http://feeds.feedburner.com/JerryNixonwork",
                Enable = false,
                Image = "https://teeu2014.eventpoint.com/resources/documents/p/teeu2014/photos/68ee7d6f-a028-e411-9bad-00155d5066d7.jpg",
                Tags = "Developer"
            });

            unitOfWork.BlogRepository.Insert(new Blog()
            {
                BlogId = Guid.NewGuid(),
                Title = "JBuilding Apps for Windows",
                Url = "http://blogs.windows.com/buildingapps/feed/",
                Enable = false,
                Image = "http://cdn.marketplaceimages.windowsphone.com/v8/images/d486a62d-d88d-4b67-8ef9-08bdbdd0e05c?imageType=ws_icon_large",
                Tags = "Developer"
            });


        }

        public void HtmlSnippets()
        {
            string HtmlSample = "<div class=\"da-img\"><img class=\"img-responsive\" src=\"http://www.limecanvas.com/wp-content/uploads/2013/02/always-edit-in-html-wordpress-plugin-banner-640x220.jpg\" alt=\"\"></div>";
            unitOfWork.HtmlSnippetsRepository.Insert(new HtmlSnippet()
            {
                HtmlSnippetId = SectionName.LeftShoulder.ToString(),
                Description = "Left Shoulder",
                Icon = "icon-doc",
                Value = HtmlSample
            });

            unitOfWork.HtmlSnippetsRepository.Insert(new HtmlSnippet()
            {
                HtmlSnippetId = SectionName.RightShoulder.ToString(),
                Description = "Right Shoulder",
                Icon = "icon-doc",
                Value = HtmlSample
            });

            unitOfWork.HtmlSnippetsRepository.Insert(new HtmlSnippet()
            {
                HtmlSnippetId = SectionName.CenterTop.ToString(),
                Description = "Center Top",
                Icon = "icon-doc",
                Value = HtmlSample
            });

            unitOfWork.HtmlSnippetsRepository.Insert(new HtmlSnippet()
            {
                HtmlSnippetId = SectionName.CenterMiddle.ToString(),
                Description = "Center Middle",
                Icon = "icon-doc",
                Value = HtmlSample
            });

            unitOfWork.HtmlSnippetsRepository.Insert(new HtmlSnippet()
            {
                HtmlSnippetId = SectionName.CenterBottom.ToString(),
                Description = "Center Bottom",
                Icon = "icon-doc",
                Value = HtmlSample
            });
        }

        public void CreateSpeakerID()
        {
            RaffaeleRialdi = Guid.NewGuid();
            Alessandro = Guid.NewGuid();
            AndreaBelloni = Guid.NewGuid();
            AlessioGogna = Guid.NewGuid();
            ClaudioMasieri = Guid.NewGuid();
            MarcoDalessandro = Guid.NewGuid();
            AlbertoBaroni = Guid.NewGuid();
            MarcoMinerva = Guid.NewGuid();
            MarcoDalPino = Guid.NewGuid();
            GuidoNoceti = Guid.NewGuid();
        }

        public void CreateSpeakers()
        {
            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = RaffaeleRialdi,
                Name = "Raffaele Rialdi",
                ProfileImage = "https://pbs.twimg.com/profile_images/1640409709/117f4781-1c5f-49af-853c-1f577139e632_400x400.png"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = Alessandro,
                Name = "Alessandro Gambaro",
                ProfileImage = "https://pbs.twimg.com/profile_images/1337759417/face.gif"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = AlessioGogna,
                Name = "Alessio Gogna",
                ProfileImage = "https://pbs.twimg.com/profile_images/2210415736/image_400x400.jpg"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = AndreaBelloni,
                Name = "Andrea Belloni",
                ProfileImage = "http://m.c.lnkd.licdn.com/mpr/mpr/shrinknp_400_400/p/7/005/00b/1d6/25e69c9.jpg"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = MarcoDalessandro,
                Name = "Marco D'Alessandro",
                ProfileImage = "http://www.dotnetliguria.net/Media/Default/Page/net-framework-user-group-della-liguria/2509480_big.jpg"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = ClaudioMasieri,
                Name = "Claudio Masieri",
                ProfileImage = "http://www.sinergetica.biz/Content/light/wide/images/people/ClaudioMasieri.jpg"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = AlbertoBaroni,
                Name = "Alberto Baroni",
                ProfileImage = "https://media.licdn.com/mpr/mpr/shrink_200_200/p/3/000/000/194/3516c39.jpg"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = MarcoMinerva,
                Name = "Marco Minerva",
                ProfileImage = "http://www.betterembedded.it/media/conference/profile/marco-minerva.png"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = MarcoDalPino,
                Name = "Marco Dal Pino",
                ProfileImage = "https://pbs.twimg.com/profile_images/549877006683226114/4Y8zTUrb.png"
            });

            unitOfWork.SpeakerRepository.Insert(new WorkshopSpeaker()
            {
                WorkshopSpeakerId = GuidoNoceti,
                Name = "Guido Noceti",
                ProfileImage = "~/Content/Unify/images/speakers.jpg"
            });
        }

        public void CreateWorkshop()
        {
            MicrosoftDevCamp();

            Workshop1Anno2013();

            Workshop2Anno2013();

            Workshop1Anno2014();

            Workshop2Anno2014();

            Workshop1Anno2015();
        }

        void Workshop1Anno2015()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Workshop 1 Anno 2015";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2015, 3, 3);
            workshop1.CreationDate = new DateTime(2015, 2, 1);
            workshop1.Description = "DotNet Liguria è orgogliosa di presentare il primo evento gratuito del 2015: appuntamento destinato ad architetti software, sviluppatori e appassonati della tecnologia Microsoft.NET, per rimanere aggiornati alle ultime novità sull’argomento.";
            workshop1.Published = true;
            workshop1.Tags = "OOXml, Event Sourcing, CQRS, Mongodb";
            workshop1.Image = "http://www.ordineingegneri.genova.it/images/leonardo.png";
            workshop1.Location = new LocationModels()
            {
                Name = "Ordine degli Ingegneri della provincia di Genova",
                Address = "Piazza della Vittoria 11/10, 16121 Genova (GE)",
                Coordinates = "44.4038549,8.944758",
                MaximumSpaces = 200
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            Guid Track1Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track1Id,
                Title = "L’utilizzo Di Frontend Basate Su Microsoft Office Utilizzando OOXml",
                StartTime = new DateTime(2015, 3, 3, 17, 00, 00),
                EndTime = new DateTime(2015, 3, 3, 18, 00, 00),
                Abstract = "Office OpenXML è il formato standard ISO DIS 29500 usato a partire da Office 2007 (file con estensione docx, xlsx e pptx). Microsoft fornisce un SDK basato sul Framework.NET che permette la generazione di documenti senza necessità di installare Office, aprendo così a una moltitudine di automazioni. Nel corso della presentazione verrà analizzato il formato del file, gli strumenti per poterlo manipolare e una serie di esempi su come generare o modificare documenti docx (Word) e xlsx (Excel). Infine, vista la popolarità del formato xlsx, verrà fatto un confronto con una libreria basata su questi strumenti e che consente la generazione degli spreadsheet ancora più rapidamente.",
                Image = "https://sharepointsamurai.files.wordpress.com/2014/04/2008040211105590dad1.gif",
                Level = 200
            });
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AlbertoBaroni));


            Guid Track2Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track2Id,
                Title = "Introduzione Alle Architetture Software Basate Su Eventi, Event Sourcing E CQRS Dalla Teoria Alla Pratica",
                StartTime = new DateTime(2015, 3, 3, 18, 00, 00),
                EndTime = new DateTime(2015, 3, 3, 19, 00, 00),
                Abstract = "Sviluppare un Domain Model può nascondere alcune insidie: quando i comportamenti del nostro dominio iniziano a diventare complessi dobbiamo fare delle scelte strutturali, di performance, di design. Una soluzione è CQRS (Command and Query Responsibility Segregation), un'architettura a stack asimmetrici che separa i comandi dalle queries di lettura. Ma CQRS spesso fa coppia con Event Sourcing e vedremo pro e contro nell'utilizzare dabase documentali per persistere il Domain Model.",
                Image = "http://logofury.com/wp-content/uploads/2004/eske_CQRS.gif",
                Level = 400
            });
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AndreaBelloni));
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(ClaudioMasieri));


            Guid Track3Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track3Id,
                Title = "Gestire Il Data Layer Attraverso Un Database Documentale: Esempi In Mongodb",
                StartTime = new DateTime(2015, 3, 3, 19, 00, 00),
                EndTime = new DateTime(2015, 3, 3, 20, 00, 00),
                Abstract = "Negli ultimi anni grazie anche alla drastica riduzione dei costi dello storage ed al crescente bisogno di memorizzare sempre più grandi quantitativi di dati, sono tornati alla ribalta i database documentali, è quindi per noi developer necessario ed obbligatorio averne una conoscenza per poterli utilizzare nel momento giusto. In questa presentazione vedremo perchè vanno usati, dove e come... ci saranno anche esempi di codice, ovviamente con linguaggio C# .Net.",
                Image = "http://www.hostingtalk.it/wp-content/uploads/2013/11/mongodb_logo.png",
                Level = 200
            });
            workshop1.Tracks[2].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(Alessandro));

            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

        void Workshop2Anno2014()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Workshop 2 Anno 2014";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2014, 10, 9);
            workshop1.CreationDate = new DateTime(2014, 9, 10);
            workshop1.Description = "Secondo evento del 2014 organizzato da Dot Net Liguria, si terrà presso Selex Elsag (via Puccini 2, Sestri Ponente), la sala è al primo piano conosciuta internamente come aula 105.";
            workshop1.Published = true;
            workshop1.Tags = "AngularJS , WebApi, OData";
            workshop1.Image = "https://lh6.googleusercontent.com/-TlY7amsfzPs/T9ZgLXXK1cI/AAAAAAABK-c/Ki-inmeYNKk/w749-h794/AngularJS-Shield-large.png";
            workshop1.Location = new LocationModels()
            {
                Name = "Selex Elsag",
                Address = "Via Puccini 2, Sestri Ponente",
                Coordinates = "44.4226218,8.8516753",
                MaximumSpaces = 100
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            Guid Track1Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track1Id,
                Title = "Sviluppare Servizi Web Con WebApi E OData",
                StartTime = new DateTime(2014, 10, 9, 17, 00, 00),
                EndTime = new DateTime(2014, 10, 9, 18, 30, 00),
                Abstract = "Con la crescita del mercato dei device è cresciuta la necessità di creare servizi web in grado di erogare dati privi di rappresentazione HTML e lo stile architetturale REST è quello che risponde meglio a tale necessità. Nel mondo .NET le WebApi permettono di costruire servizi web REST-style con semplicità e potenza grazie ad una pipeline molto espandibile. Sopra questa solida API Microsoft ha sviluppato il protocollo oData, oggi standard OASIS, che permette di produrre rapidamente servizi di accesso ai dati in modalità CRUD. Nella sessione vedremo esempi dei due tipi di servizi, di cosa offra l'estendibilità e degli utilizzi al di fuori dello scenario web.",
                Image = "http://www.cloudtalk.it/wp-content/uploads/2012/05/logo-odata1.png",
                Level = 300
            });
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));


            Guid Track2Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track2Id,
                Title = "AngularJS In Practice",
                StartTime = new DateTime(2014, 10, 9, 18, 30, 00),
                EndTime = new DateTime(2014, 10, 9, 20, 00, 00),
                Abstract = "Vista la diffusione e la proliferazione di frameworks JavaScript full stack e la sempre crescente necessità di avere applicazioni responsive e multi platform, volevamo condividere l'esperienza day by day di uno sviluppatore che ha già lavorato con uno dei più robusti e in voga: angularjs. Una overview su pattern, directives, controllers, interazione con un back-end json , gli strumenti per lo sviluppo e l'integrazione con la libreria Bootstrap.",
                Image = "https://lh6.googleusercontent.com/-TlY7amsfzPs/T9ZgLXXK1cI/AAAAAAABK-c/Ki-inmeYNKk/w749-h794/AngularJS-Shield-large.png",
                Level = 400,
            });
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(GuidoNoceti));


            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

        void Workshop1Anno2014()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Workshop 1 Anno 2014";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2014, 6, 5);
            workshop1.CreationDate = new DateTime(2014, 5, 10);
            workshop1.Description = "Primo evento del 2014 organizzato da Dot Net Liguria, si terrà presso Selex Elsag (via Puccini 2, Sestri Ponente), la sala è al primo piano conosciuta internamente come aula 105.";
            workshop1.Published = true;
            workshop1.Tags = "Roslyn , Asp.Net";
            workshop1.Image = "http://www.daoudisamir.com/wp-content/uploads/2015/01/visual-studio-2013-logo.png";
            workshop1.Location = new LocationModels()
            {
                Name = "Selex Elsag",
                Address = "Via Puccini 2, Sestri Ponente",
                Coordinates = "44.4226218,8.8516753",
                MaximumSpaces = 100
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            Guid Track1Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track1Id,
                Title = "Roundtable",
                StartTime = new DateTime(2014, 6, 5, 17, 00, 00),
                EndTime = new DateTime(2014, 6, 5, 18, 00, 00),
                Abstract = "Le novità presentate alla conferenza build 2014 di San Francisco",
                Image = "http://www.tlnt.com/media/2011/05/Roundtable-200x200.jpg",
                Level = 100
            });
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AlessioGogna));


            Guid Track2Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track2Id,
                Title = "Il compilatore di C# diventa programmabile: il progetto Roslyn",
                StartTime = new DateTime(2014, 6, 5, 18, 00, 00),
                EndTime = new DateTime(2014, 6, 5, 19, 00, 00),
                Abstract = "Il progetto Roslyn è il nuovo compilatore C# (e VB) dove le API interne sono diventate pubbliche e perciò qualsiasi applicazione può trarre beneficio dei servizi del compilatore. Paradossalmente il nuovo compilatore è più interessante per queste funzionalità rispetto alle nuove funzionalità che verranno aggiunte nell'imminente C# 6.0. Grazie a Roslyn gli sviluppatori possono creare tool, analizzare i sorgenti ed estrarre dal codice sorgente di testo tutte le informazioni sintattiche e semantiche. Durante la sessione vedremo diversi esempi di come poter trarre beneficio di queste API, dai semplici tool alla più complessa integrazione con il refactoring di Visual Studio.",
                Image = "http://phoenixcoded.com/images/photo_1389636992_quiz_image_temp.png",
                Level = 300
            });
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));

            Guid Track3Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track3Id,
                Title = "Novità per gli sviluppatori web con Visual Studio e ASP.NET.",
                StartTime = new DateTime(2014, 6, 5, 19, 00, 00),
                EndTime = new DateTime(2014, 6, 5, 20, 00, 00),
                Abstract = "Lo sviluppo web evolve rapidamente, e Visual Studio e ASP.NET cercano di tenere il passo, puntando ad essere sempre di più l'IDE di riferimento per gli sviluppatori web di tutti i tipi. Daremo un'occhiata alle nuove funzionalità introdotte in ASP.NET, le nuove idee in sviluppo web front-end, le novità delle Web Essentials e un po' del futuro ASP.NET.",
                Image = "http://resource.thaicreate.com/upload/stock/20120503202942.gif",
                Level = 200
            });
            workshop1.Tracks[2].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AlessioGogna));


            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

        void Workshop2Anno2013()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Workshop 2 Anno 2013";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2013, 12, 5);
            workshop1.CreationDate = new DateTime(2013, 11, 1);
            workshop1.Description = "DotNet Liguria è orgogliosa di presentare il secondo evento gratuito del 2013: appuntamento destinato a architetti software, sviluppatori e appassionati della tecnologia Microsoft.NET, per rimanere aggiornati alle ultime novità sull’argomento, si terrà presso Selex Elsag (via Puccini 2, Sestri Ponente) che ringraziamo per averci messo a disposizione la sala.";
            workshop1.Published = true;
            workshop1.Tags = "WinRT, Windows 8.1, Windows Phone 8";
            workshop1.Image = "https://miapple.me/wp-content/uploads/2013/07/Windows-8.1-Logo.jpg";
            workshop1.Location = new LocationModels()
            {
                Name = "Selex Elsag",
                Address = "Via Puccini 2, Sestri Ponente",
                Coordinates = "44.4226218,8.8516753",
                MaximumSpaces = 100
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            Guid Track1Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track1Id,
                Title = "Le novità di WinRT in Windows 8.1",
                StartTime = new DateTime(2013, 12, 5, 17, 00, 00),
                EndTime = new DateTime(2013, 12, 5, 18, 30, 00),
                Abstract = "Grazie all’aggiornamento gratuito a Windows 8.1 ci sono circa 5000 nuove API a disposizione degli sviluppatori di Windows Store applications. Durante la sessione vedremo innanzitutto i meccanismi che permettono a WinRT di poter evolvere nel versioning senza causare problemi di retro-compatibilità. Scenderemo poi nei dettagli per analizzare le tante novità dei controlli XAML, le viste multiple e altre interessanti API.  ",
                Image = "https://miapple.me/wp-content/uploads/2013/07/Windows-8.1-Logo.jpg",
                Level = 100
            });
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));


            Guid Track2Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track2Id,
                Title = "Windows Phone 8 e Windows 8.1 Store apps – Uno scenario Line of Business",
                StartTime = new DateTime(2013, 12, 5, 18, 30, 00),
                EndTime = new DateTime(2013, 12, 5, 20, 00, 00),
                Abstract = "“Non solo consumer” è il tema di questa sessione dove le nuove feature presenti in Windows Phone 8 e in Windows 8.1 permettono di gestire uno scenario LOB. Attraverso il pieno supporto a Bluetooth, NFC, HID e MultiView vedremo come gestire facilmente il processo che dal picking di magazzino porta alla generazione di un documento di trasporto. Una sessione ricca di codice per quello che vuole esse-re un case study che integra un’ampia gamma di novità (Windows Store apps, Windows Phone 8 apps, SignalR and more)! ",
                Image = "http://www.digitato.it/files/Windows-Phone-8.jpg",
                Level = 300
            });
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AndreaBelloni));
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(MarcoMinerva));
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(MarcoDalPino));

            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

        void Workshop1Anno2013()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Workshop 1 Anno 2013";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2013, 4, 5);
            workshop1.CreationDate = new DateTime(2013, 3, 1);
            workshop1.Description = "Siamo lieti di invitare tutti gli sviluppatori interessati al primo evento gratuito del 2013 organizzato da DotNetLiguria, che si terrà presso Selex Elsag (via Puccini 2, Sestri Ponente) che ringraziamo per averci messo a disposizione la sala.";
            workshop1.Published = true;
            workshop1.Tags = "Sviluppo nativo, Sviluppo managed, HTML5, Knockout";
            workshop1.Image = "http://www.w3.org/html/logo/downloads/HTML5_Badge_512.png";
            workshop1.Location = new LocationModels()
            {
                Name = "Selex Elsag",
                Address = "Via Puccini 2, Sestri Ponente",
                Coordinates = "44.4226218,8.8516753",
                MaximumSpaces = 100
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            Guid Track1Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track1Id,
                Title = "Roundtable - Sviluppo nativo o managed: quale futuro ?",
                StartTime = new DateTime(2013, 4, 5, 16, 30, 00),
                EndTime = new DateTime(2013, 4, 5, 17, 30, 00),
                Abstract = "Con l’approvazione dello standard C++11 e di ulteriori novità nel futuro C++14 lo sviluppo nativo ha ripreso vigore non solo per motivi di performance o di consumo della batteria dei dispositivi portatili. Cosa spaventa lo sviluppatore nell’affrontare lo sviluppo nativo? Sintassi, librerie, intellisense, compilatore, tools o produttività? Nel corso della roundtable raccoglieremo suggerimenti su un eventuale futuro evento dedicato al mondo nativo).",
                Image = "http://sivertimes.com/wp-content/uploads/2015/04/round_table_meeting_.jpg",
                Level = 100
            });
            workshop1.Tracks[0].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(RaffaeleRialdi));


            Guid Track2Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track2Id,
                Title = "HTML5 - Web (r)evolution",
                StartTime = new DateTime(2013, 4, 5, 17, 30, 00),
                EndTime = new DateTime(2013, 4, 5, 18, 30, 00),
                Abstract = "Il nuovo standard HTML non introduce soltanto nuovi tags, ma un modo profondamente diverso di approcciare allo sviluppo di pagine web. In questa sessione cercheremo di analizzare le fondamentali differenze con lo standard precedente per arrivare alle ragioni che stanno dietro a tali cambiamenti.",
                Image = "http://www.w3.org/html/logo/downloads/HTML5_Badge_512.png",
                Level = 200
            });
            workshop1.Tracks[1].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AlessioGogna));

            Guid Track3Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track3Id,
                Title = "Knockout – Dynamic Javascript UI attraverso il pattern MVVM",
                StartTime = new DateTime(2013, 4, 5, 18, 30, 00),
                EndTime = new DateTime(2013, 4, 5, 19, 15, 00),
                Abstract = "Il nuovo standard HTML non introduce soltanto nuovi tags, ma un modo profondamente diverso di approcciare allo sviluppo di pagine web. In questa sessione cercheremo di analizzare le fondamentali differenze con lo standard precedente per arrivare alle ragioni che stanno dietro a tali cambiamenti.",
                Image = "http://www.edgewater-consulting.com/SiteCollectionImages/Article%20Page%20Images/knockoutjs-banner.jpg",
                Level = 300
            });
            workshop1.Tracks[2].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(AndreaBelloni));


            Guid Track4Id = Guid.NewGuid();
            workshop1.Tracks.Add(new WorkshopTrack()
            {
                WorkshopTrackId = Track4Id,
                Title = "Real-Time With ASP.NET con SignalR.",
                StartTime = new DateTime(2013, 4, 5, 19, 15, 00),
                EndTime = new DateTime(2013, 4, 5, 20, 00, 00),
                Abstract = "Al giorno d'oggi si cerca di portare tutto quello che era applicazione desktop su web, fino a ieri il real time era una nota dolente, oggi qualcosa è cambiato e possiamo pensare di avere un sistem real time anche su web. SignalR è una libreria che permette le notifiche in real-time sul web verso client desktop, brower di vecchia e nuova generazione e dispositivi mobile. Che siano disponibili le websocket o meno SignalR fornisce in modo trasparente la sua funzionalità senza richiedere alcuna modifica al codice.",
                Image = "http://blogs.microsoft.co.il/gadib/wp-content/uploads/sites/1318/2014/09/signalr.png",
                Level = 300
            });
            workshop1.Tracks[3].Speakers.Add(unitOfWork.SpeakerRepository.SelectByID(Alessandro));


            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

        void MicrosoftDevCamp()
        {
            Workshop workshop1 = new Workshop();
            workshop1.Title = "Microsoft Dev Camp";
            workshop1.WorkshopId = Guid.NewGuid();
            workshop1.EventDate = new DateTime(2012, 11, 29);
            workshop1.CreationDate = new DateTime(2012, 10, 1);
            workshop1.Description = "TODO";
            workshop1.Published = true;
            workshop1.Tags = "Windows 8, Windows Phone, Windows Azure";
            workshop1.Image = "http://www.plaffo.com/wp/wp-content/uploads/2012/09/MDC.png";
            workshop1.Location = new LocationModels()
            {
                Name = "Selex Elsag",
                Address = "Via Puccini 2, Sestri Ponente",
                Coordinates = "44.4226218,8.8516753",
                MaximumSpaces = 100
            };

            workshop1.Tracks = new List<WorkshopTrack>();

            unitOfWork.WorkshopRepository.Insert(workshop1);
        }

    }
}