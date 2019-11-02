using DotNetLiguria.Repository;
using DotNetLiguria.Web.Common;
using DotNetLiguria.Web.DAL;
using DotNetLiguria.Models;
using Microsoft.AspNet.Identity.Owin;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Entity;
using System.Data.Entity.Migrations;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Web;
using System.Web.Mvc;
using DotNetLiguria.Web.Models;
using DotNetLiguria.BLL.Implementation;
using Hangfire;
using DotNetLiguria.Web.Helpers;
using DotNetLiguria.ViewModels;

namespace DotNetLiguria.Web.Controllers
{
    [Authorize(Roles = "Admin, DotNetDuke")]
    public class DashboardController : BaseController
    {
        public DashboardController(DashboardBusiness _business) : base(_business)
        {

        }

        private readonly string CKEditorUploads = "~/Uploads/CKEditor/";
        private readonly string WORKSHOPUPLOADFILES = "/Uploads/workshops/";
        private readonly string SPEAKERUPLOADFILES = "/Uploads/speakers/";
        private readonly string SLIDERUPLOADFILES = "/Uploads/sliders/";

        public ActionResult Index()
        {
            return View();
        }
        public ActionResult Test()
        {
            return View();
        }
        public ActionResult CreateDatabase()
        {
            //if (Business.Workshop_GetList().Count() == 0)
            //{
            TestFactory test = new TestFactory();
            test.CreateDefaultDatabase();
            //}

            return RedirectToAction("Index", "Home");
        }

        public ActionResult DeleteDatabase()
        {
            //foreach (var workshop in Business.Workshop_GetList())
            //{
            //    //workshop.Tracks.ToList().ForEach(r => Repository.WorkshopRepository.Delete(r));

            //    workshop.Tracks.Clear();
            //    workshop.Workshopsubscribed.Clear();
            //    workshop.WorkshopFiles.Clear();

            //    Business.Workshop_Delete(workshop.WorkshopId);
            //}

            //foreach (var news in Repository.NewsRepository.SelectAll())
            //{
            //    Repository.NewsRepository.Delete(news.NewsId);
            //}

            //foreach (var blog in Repository.BlogRepository.SelectAll())
            //{
            //    Repository.BlogRepository.Delete(blog.BlogId);
            //}

            //foreach (var speaker in Repository.SpeakerRepository.SelectAll())
            //{
            //    Repository.SpeakerRepository.Delete(speaker.WorkshopSpeakerId);
            //}

            //foreach (var html in Repository.HtmlSnippetsRepository.SelectAll())
            //{
            //    Repository.HtmlSnippetsRepository.Delete(html.HtmlSnippetId);
            //}

            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [Blog]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [HtmlSnippet]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [News]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [Workshop]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [TrackSpeaker]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [Track]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [Speaker]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [WorkshopFeedback]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [WorkshopFile]");
            //Repository.context.Database.ExecuteSqlCommand("TRUNCATE TABLE [WorkshopUndersigned]");

            //Repository.Save();

            //Repository.context.Database.ExecuteSqlCommand("delete from [DotNetLiguria.Web].[dbo].[Track]");

            return RedirectToAction("Index", "Dashboard");
        }

        #region CkEditor

        public void Uploadnow(HttpPostedFileWrapper upload)
        {
            if (upload != null)
            {
                //string ImageName = upload.FileName;
                FileInfo imageFile = new FileInfo(upload.FileName);
                string path = System.IO.Path.Combine(Server.MapPath(CKEditorUploads), imageFile.Name);
                upload.SaveAs(path);
            }
        }

        public ActionResult UploadPartial()
        {
            var appData = Server.MapPath(CKEditorUploads);
            var images = Directory.GetFiles(appData).Select(x => new ImageViewModels
            {
                Url = Url.Content(CKEditorUploads + Path.GetFileName(x))
            });
            return View(images);
        }

        #endregion

        #region Workshop

        [HttpGet]
        public ActionResult CreateWorkshop()
        {
            return View();
        }

        public ActionResult EditWorkshop(Guid workshopid)
        {
            Workshop workshop = Business.Workshop_Get(workshopid);

            ViewBag.FileType = new SelectList(Enum.GetValues(typeof(WorkshopFileType)).Cast<WorkshopFileType>().Select(v => new SelectListItem
            {
                Text = v.ToString(),
                Value = ((int)v).ToString()
            }).ToList(), "Value", "Text");

            return View(workshop);
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult UpdateWorkshop(Workshop model)
        {
            var workshop = Business.Workshop_Update(model);

            return RedirectToAction("EditWorkshop", new { workshopid = workshop.WorkshopId });
        }


        [HttpPost]
        public ActionResult UpdateWorkshopLogo(Workshop model)
        {
            var workshop = Business.Workshop_Get(model.WorkshopId);

            //Image
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string workshopFolder = WORKSHOPUPLOADFILES + workshop.WorkshopId;

                string path = AppDomain.CurrentDomain.BaseDirectory + workshopFolder;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                //string filename = Path.GetFileName(Request.Files[upload].FileName);
                string filename = "logo.png";
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                WorkshopFile workshopfile = new WorkshopFile();
                workshopfile.WorkshopFileId = Guid.NewGuid();
                workshopfile.Title = filename;
                workshopfile.FileName = filename;
                workshopfile.FileType = WorkshopFileType.Image;
                workshopfile.FullPath = Path.Combine(workshopFolder, filename);

                if (workshop.WorkshopFiles == null)
                    workshop.WorkshopFiles = new List<WorkshopFile>();

                //Delete old Logo File
                var olderLogo = workshop.WorkshopFiles.Where(x => x.FileType == WorkshopFileType.Image).SingleOrDefault();
                if (olderLogo != null)
                    workshop.WorkshopFiles.Remove(olderLogo);

                workshop.WorkshopFiles.Add(workshopfile);
                workshop.Image = workshopfile.FullPath;

                Business.Workshop_Update(workshop);
            }

            return RedirectToAction("EditWorkshop", new { workshopid = workshop.WorkshopId });
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddWorkshop(Workshop model)
        {

            var workshop = Business.Workshop_Create(model);

            //Image
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string workshopFolder = WORKSHOPUPLOADFILES + workshop.WorkshopId;

                string path = AppDomain.CurrentDomain.BaseDirectory + workshopFolder;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                //string filename = Path.GetFileName(Request.Files[upload].FileName);
                string filename = "logo.png";
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                WorkshopFile workshopfile = new WorkshopFile();
                workshopfile.WorkshopFileId = Guid.NewGuid();
                workshopfile.Title = filename;
                workshopfile.FileName = filename;
                workshopfile.FileType = WorkshopFileType.Image;
                workshopfile.FullPath = Path.Combine(workshopFolder, filename);

                Business.Workshop_UpdateFiles(workshop.WorkshopId, new List<WorkshopFile>() { workshopfile });
            }

            return RedirectToAction("WorkshopList");
        }

        [HttpGet]
        public ActionResult WorkshopTracks(Guid workshopId)
        {
            //var speakers = Business.WorkshopSpeaker_GetList();

            //ViewBag.Speakers = new MultiSelectList(speakers, "WorkshopSpeakerId", "Name");

            Workshop workshop = Business.Workshop_Get(workshopId);

            Session["WorkshopId"] = workshop.WorkshopId;

            return View(workshop);
        }

        [HttpPost]
        public ActionResult AddTrack(WorkshopTrack model, Guid[] Speakers)
        {
            Business.WorkshopTrack_Create(model.WorkshopId, model, Speakers);

            return RedirectToAction("EditWorkshop", new { model.WorkshopId });
        }


        public ActionResult EditTrack(Guid workshopid, Guid workshoptrackid)
        {
            //var speakers = Business.WorkshopSpeaker_GetList();

            //ViewBag.Speakers = new MultiSelectList(speakers, "WorkshopSpeakerId", "Name");

            Workshop workshop = Business.Workshop_Get(workshopid);

            WorkshopTrack track = workshop.Tracks.Where(x => x.WorkshopTrackId.Equals(workshoptrackid)).Single();

            WorkshopTrackViewModel viewModel = new WorkshopTrackViewModel();
            viewModel.SelectedSpeakers = track.Speakers.Select(x => x.WorkshopSpeakerId).ToArray();
            viewModel.Track = track;

            return View(viewModel);
        }


        public ActionResult DeleteTrack(Guid workshopid, Guid workshoptrackid)
        {
            Business.WorkshopTrack_Delete(workshoptrackid);

            return RedirectToAction("EditWorkshop", new { workshopid });
        }

        [HttpPost]
        public ActionResult UpdateTrack(WorkshopTrackViewModel model, Guid[] SelectedSpeakers)
        {
            Business.WorkshopTrack_Update(model, SelectedSpeakers);

            return RedirectToAction("EditWorkshop", new { model.Track.WorkshopId });
        }

        public ActionResult WorkshopList()
        {
            return View();
        }

        [HttpGet]
        public ActionResult WorkshopFiles(Guid workshopId)
        {
            Workshop workshop = Business.Workshop_Get(workshopId);

            ViewBag.FileType = new SelectList(Enum.GetValues(typeof(WorkshopFileType)).Cast<WorkshopFileType>().Select(v => new SelectListItem
            {
                Text = v.ToString(),
                Value = ((int)v).ToString()
            }).ToList(), "Value", "Text");

            return View(workshop);
        }

        [HttpPost]
        public ActionResult WorkshopFilesUpload(Guid workshopId, string title, int filetype)
        {
            bool isSavedSuccessfully = true;
            string responseText = string.Empty;

            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    isSavedSuccessfully = false;
                    responseText = "No files founded!";
                    continue;
                }

                string workshopFolder = WORKSHOPUPLOADFILES + workshopId;

                string path = AppDomain.CurrentDomain.BaseDirectory + workshopFolder;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                Workshop workshop = Business.Workshop_Get(workshopId);

                //var findIt = workshop.WorkshopFiles.Where(x => x.FileName.Equals(filename)).FirstOrDefault();

                //if (findIt != null)
                //{
                //    isSavedSuccessfully = false;
                //    responseText = "File already exist!";
                //    continue;
                //}

                //findIt = workshop.WorkshopFiles.Where(x => x.Title.Equals(filename)).FirstOrDefault();

                //if (findIt != null)
                //{
                //    isSavedSuccessfully = false;
                //    responseText = "Title already exist!";
                //    continue;
                //}

                WorkshopFile workshopfile = new WorkshopFile();
                workshopfile.WorkshopFileId = Guid.NewGuid();
                workshopfile.Title = title;
                workshopfile.FileName = filename;
                workshopfile.FileType = (WorkshopFileType)filetype;
                workshopfile.FullPath = Path.Combine(workshopFolder, filename);

                workshop.WorkshopFiles.Add(workshopfile);

                Business.Workshop_Update(workshop);

                ViewBag.FileType = new SelectList(Enum.GetValues(typeof(WorkshopFileType)).Cast<WorkshopFileType>().Select(v => new SelectListItem
                {
                    Text = v.ToString(),
                    Value = ((int)v).ToString()
                }).ToList(), "Value", "Text");
            }

            return RedirectToAction("EditWorkshop", new { workshopid = workshopId });
            //return Json(responseText);
        }

        public ActionResult DeleteWorkshopFiles(Guid workshopId, Guid WorkshopFileId)
        {
            Workshop workshop = Business.Workshop_Get(workshopId);

            var file = workshop.WorkshopFiles.Where(x => x.WorkshopFileId.Equals(WorkshopFileId)).FirstOrDefault();

            string workshopFolder = WORKSHOPUPLOADFILES + workshopId;

            string path = AppDomain.CurrentDomain.BaseDirectory + workshopFolder;

            if (file != null && System.IO.File.Exists(Path.Combine(path, file.FileName)))
            {
                System.IO.File.Delete(Path.Combine(path, file.FileName));
            }

            workshop.WorkshopFiles.Remove(file);

            Business.Workshop_Update(workshop);

            ViewBag.FileType = new SelectList(Enum.GetValues(typeof(WorkshopFileType)).Cast<WorkshopFileType>().Select(v => new SelectListItem
            {
                Text = v.ToString(),
                Value = ((int)v).ToString()
            }).ToList(), "Value", "Text");

            return RedirectToAction("EditWorkshop", new { workshopid = workshopId });
        }

        public ActionResult WorkshopCheckIn(Guid workshopId)
        {
            Workshop workshop = Business.Workshop_Get(workshopId);

            Session["WorkshopId"] = workshop.WorkshopId;

            return View(workshop);
        }

        public ActionResult CheckIn(Guid workshopId, Guid workshopUndersignedId)
        {
            Workshop workshop = Business.Workshop_Get(workshopId);

            var subscriber = workshop.Workshopsubscribed.Where(x => x.WorkshopUndersignedId.Equals(workshopUndersignedId)).FirstOrDefault();

            if (subscriber != null)
            {
                subscriber.CheckIn = true;

                Business.Notification_Create(new Notification()
                {
                    NotificationId = Guid.NewGuid(),
                    NotificationTypeId = NotificationType.CheckIn,
                    Timestamp = DateTime.Now,
                    User = subscriber.User,
                    Description = workshop.Title
                });

                BackgroundJob.Enqueue<MailerService>(x => x.WorkshopCheckIn(workshop.WorkshopId, subscriber.User.Email));
            }

            return View("WorkshopCheckIn", workshop);
        }

        public ActionResult CheckInAll(Guid workshopId)
        {
            Workshop workshop = Business.Workshop_Get(workshopId);

            var subscribers = workshop.Workshopsubscribed.Where(x => x.CheckIn == false).ToList();

            if (subscribers != null)
            {
                foreach (var item in subscribers)
                {
                    item.CheckIn = true;

                    Business.Notification_Create(new Notification()
                    {
                        NotificationId = Guid.NewGuid(),
                        NotificationTypeId = NotificationType.CheckIn,
                        Timestamp = DateTime.Now,
                        User = item.User,
                        Description = workshop.Title
                    });

                    BackgroundJob.Enqueue<MailerService>(x => x.WorkshopCheckIn(workshop.WorkshopId, item.User.Email));
                }
            }

            return View("WorkshopCheckIn", workshop);
        }

        public ActionResult DeleteWorkshop(Guid workshopId)
        {
            Business.Workshop_Delete(workshopId);

            return RedirectToAction("WorkshopList");
        }

        #endregion

        #region Speakers

        public ActionResult Speakers()
        {
            return View(Business.WorkshopSpeaker_GetList());
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult AddSpeaker(WorkshopSpeaker model)
        {
            WorkshopSpeaker speaker = new WorkshopSpeaker();
            speaker.WorkshopSpeakerId = Guid.NewGuid();
            speaker.Name = model.Name;
            speaker.BlogHtml = model.BlogHtml;

            Business.WorkshopSpeaker_Insert(speaker);

            //Image
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SPEAKERUPLOADFILES;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                speaker.ProfileImage = Path.Combine(SPEAKERUPLOADFILES, filename);

                Business.WorkshopSpeaker_Update(speaker);
            }

            return View("Speakers", Business.WorkshopSpeaker_GetList());
        }

        public ActionResult EditSpeaker(Guid WorkshopSpeakerId)
        {
            var speaker = Business.WorkshopSpeaker_Get(WorkshopSpeakerId);

            return View(speaker);
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult UpdateSpeaker(WorkshopSpeaker model)
        {
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SPEAKERUPLOADFILES;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                model.ProfileImage = Path.Combine(SPEAKERUPLOADFILES, filename);
            }

            Business.WorkshopSpeaker_Update(model);

            return RedirectToAction("Speakers");
        }

        public ActionResult DeleteSpeaker(Guid WorkshopSpeakerId)
        {
            Business.WorkshopSpeaker_Delete(WorkshopSpeakerId);

            return View("Speakers", Business.WorkshopSpeaker_GetList());
        }

        #endregion

        #region Blogs

        public ActionResult Blogs()
        {
            return View(Business.Blog_GetList());
        }

        [HttpPost]
        public ActionResult AddBlog(Blog model)
        {
            Business.Blog_Create(model);

            return View("Blogs", Business.Blog_GetList());
        }


        public ActionResult DeleteBlog(Guid blogId)
        {
            Business.Blog_Delete(blogId);

            return View("Blogs", Business.Blog_GetList());
        }

        public ActionResult EnableBlog(Guid blogId)
        {
            Business.Blog_EnableDisable(blogId);

            return View("Blogs", Business.Blog_GetList());
        }

        #endregion

        #region News

        public ActionResult News()
        {
            return View(Business.News_GetList());
        }

        [HttpPost]
        public ActionResult AddNews(News model)
        {
            Business.News_Create(model);

            return View("News", Business.News_GetList());
        }


        public ActionResult DeleteNews(Guid newsId)
        {
            Business.News_Delete(newsId);

            return View("News", Business.News_GetList());
        }

        public ActionResult EnableNews(Guid newsId)
        {
            Business.News_EnableDisable(newsId);

            return View("News", Business.News_GetList());
        }



        #endregion

        #region HomeShape

        public ActionResult Slider()
        {
            var sliders = Business.Slider_GetAll();

            return View(sliders);
        }
        public ActionResult SliderGuide()
        {
            return View();
        }

        string invalid = new string(Path.GetInvalidFileNameChars()) + new string(Path.GetInvalidPathChars());

        string ValidatePath(string path)
        {
            foreach (char c in invalid)
            {
                path = path.Replace(c.ToString(), "");
            }

            return path;
        }

    public ActionResult AddSlider(Slider model)
        {
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SLIDERUPLOADFILES + ValidatePath(model.Title);

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));


                model.Image = Path.Combine(SLIDERUPLOADFILES, ValidatePath(model.Title), filename);
            }

            Business.Slider_Create(model);

            return RedirectToAction("Slider");
        }

        public ActionResult EditSlider(Guid sliderId)
        {
            var slider = Business.Slider_Get(sliderId);

            return View(slider);
        }

        [HttpPost]
        public ActionResult EditSlider(Slider model)
        {
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SLIDERUPLOADFILES + model.Title;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                model.Image = Path.Combine(SLIDERUPLOADFILES, model.Title, filename);
            }

            Business.Slider_Update(model);

            return View(model);
        }

        public ActionResult DeleteSlider(Guid sliderId)
        {
            var slider = Business.Slider_Get(sliderId);

            string path = AppDomain.CurrentDomain.BaseDirectory + SLIDERUPLOADFILES + slider.Title;

            if (System.IO.Directory.Exists(path))
            {
                System.IO.Directory.Delete(path, true);
            }

            Business.Slider_Delete(sliderId);

            return RedirectToAction("Slider");
        }

        public ActionResult EnableDisableSlider(Guid sliderId)
        {
            Business.Slider_EnableDisable(sliderId);

            return RedirectToAction("Slider");
        }

        public ActionResult AddImageSliderObj(ImageSliderObj model)
        {
            var slider = Business.Slider_Get(model.SliderObjBaseId);

            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SLIDERUPLOADFILES + slider.Title;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                model.Image = Path.Combine(SLIDERUPLOADFILES, slider.Title, filename);
            }

            slider = Business.ImageSliderObj_Create(model);

            return RedirectToAction("EditSlider", slider);
        }

        public ActionResult AddVideoSliderObj(VideoSliderObj model)
        {
            var slider = Business.VideoSliderObj_Create(model);

            return RedirectToAction("EditSlider", slider);
        }

        [ValidateInput(false)]
        public ActionResult AddCustomHtmlSliderObj(CustomHtmlSliderObj model)
        {
            var slider = Business.CustomHtmlSliderObj_Create(model);

            return RedirectToAction("EditSlider", slider);
        }

        public ActionResult DeleteSliderObj(Guid sliderObjId)
        {
            var slider = Business.SliderObj_Delete(sliderObjId);

            return View("EditSlider", slider);
        }

        public ActionResult EditSliderObj(Guid sliderObjId)
        {
            var sliderObj = Business.SliderObj_Get(sliderObjId);

            if (sliderObj.GetType().BaseType == typeof(ImageSliderObj))
            {
                return View("EditImageSliderObj", sliderObj);
            }
            else if (sliderObj.GetType().BaseType == typeof(VideoSliderObj))
            {
                return View("EditVideoSliderObj", sliderObj);
            }
            else if (sliderObj.GetType().BaseType == typeof(CustomHtmlSliderObj))
            {
                return View("EditCustomHtmlSliderObj", sliderObj);
            }
            else return null;
        }

        [HttpPost]
        public ActionResult EditImageSliderObj(ImageSliderObj model)
        {
            foreach (string upload in Request.Files)
            {
                if (Request.Files[upload] == null || Request.Files[upload].ContentLength == 0)
                {
                    continue;
                }

                string path = AppDomain.CurrentDomain.BaseDirectory + SLIDERUPLOADFILES + model.Slider.Title;

                if (!System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.CreateDirectory(path);
                }

                string filename = Path.GetFileName(Request.Files[upload].FileName);
                Request.Files[upload].SaveAs(Path.Combine(path, filename));

                model.Image = Path.Combine(SLIDERUPLOADFILES, filename); ;
            }

            Business.ImageSliderObj_Update(model);

            return RedirectToAction("EditSlider", new { sliderId = model.SliderId });
        }

        [HttpPost]
        public ActionResult EditVideoSliderObj(VideoSliderObj model)
        {
            Business.VideoSliderObj_Update(model);

            return RedirectToAction("EditSlider", new { sliderId = model.SliderId });
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult EditCustomHtmlSliderObj(CustomHtmlSliderObj model)
        {
            Business.CustomHtmlSliderObj_Update(model);

            return RedirectToAction("EditSlider", new { sliderId = model.SliderId });
        }

        public ActionResult HomeShape(string htmlSnippetId)
        {
            var snippets = Business.HtmlSnippet_GetAll();

            HtmlSnippet snippet;

            if (string.IsNullOrEmpty(htmlSnippetId))
            {
                snippet = snippets.FirstOrDefault();
            }
            else snippet = snippets.Where(x => x.HtmlSnippetId.Equals(htmlSnippetId)).Single();

            ViewBag.Snipperts = snippets;

            return View(snippet);
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult UpdateSnippet(HtmlSnippet model)
        {
            var snippets = Business.HtmlSnippet_GetAll();

            Business.HtmlSnippet_Update(model);

            ViewBag.Snipperts = snippets;

            return View("HomeShape", model);
        }

        #endregion

        #region User

        private ApplicationUserManager _userManager;
        public ApplicationUserManager UserManager
        {
            get
            {
                return _userManager ?? HttpContext.GetOwinContext().GetUserManager<ApplicationUserManager>();
            }
            private set
            {
                _userManager = value;
            }
        }

        public ActionResult Users()
        {
            var users = Business.CustomUser_GetAll();

            return View(users);
        }

        #endregion

        #region OfferteLavoro

        public ActionResult OfferteLavoro()
        {
            var offerteLavoro = Business.OfferteLavoro_GetList();

            return View(offerteLavoro);
        }

        public ActionResult DeleteOfferteLavoro(Guid offertaLavoroId)
        {
            Business.OfferteLavoro_Delete(offertaLavoroId);

            return View("OfferteLavoro", Business.OfferteLavoro_GetList());
        }

        public ActionResult EditOffertaLavoro(Guid offertaLavoroId)
        {
            var offerta = Business.OfferteLavoro_Get(offertaLavoroId);

            return View("EditOffertaLavoro", offerta);
        }

        [HttpPost]
        [ValidateInput(false)]
        public ActionResult OffertaLavoroUpdate(OffertaLavoro model)
        {
            Business.OfferteLavoro_Update(model);

            return RedirectToAction("OfferteLavoro");
        }

        public ActionResult CreateOffertaLavoro()
        {
            return View("CreateOffertaLavoro");
        }


        [HttpPost]
        [ValidateInput(false)]
        public ActionResult CreateOffertaLavoro(OffertaLavoro model)
        {
            Business.OfferteLavoro_Create(model, CustomUser);

            return RedirectToAction("OfferteLavoro");
        }

        public ActionResult EnableOfferteLavoro(Guid offertaLavoroId)
        {
            Business.OfferteLavoro_EnableDisable(offertaLavoroId);

            return View("OfferteLavoro", Business.OfferteLavoro_GetList());
        }

        #endregion

    }
}