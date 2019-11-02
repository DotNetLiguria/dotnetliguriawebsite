using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DotNetLiguria.Models;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.Repository.Utils;
using DotNetLiguria.Repository;
using DotNetLiguria.BLL.Exceptions;
using DotNetLiguria.ViewModels;

namespace DotNetLiguria.BLL.Implementation
{
    public class DashboardBusiness : IDashboardBusiness
    {
        readonly log4net.ILog logger = log4net.LogManager.GetLogger("Admin");

        IUnitOfWork Repository;

        public DashboardBusiness(UnitOfWork _unitOfWork)
        {
            this.Repository = _unitOfWork;  //RepositoryFactory.Get<UnitOfWork>();
        }

        #region Database

        public void CreateDB()
        {
            DotNetLiguriaContext.CreateDb();
        }

        public void Migration()
        {
            //DotNetLiguriaContext.Migration();
            //Repository.Save();
        }

        #endregion

        #region HomeShape

        public void Slider_Create(Slider model)
        {
            try
            {
                Slider slider = new Slider();
                slider.SliderId = Guid.NewGuid();
                slider.Title = model.Title;
                slider.SlideDelay = model.SlideDelay;
                slider.SlideTransitionType = model.SlideTransitionType;
                slider.Enable = model.Enable;
                slider.Image = model.Image;

                Repository.SliderRepository.Insert(slider);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Models.Slider Slider_Get(Guid sliderId)
        {
            try
            {
                return Repository.SliderRepository.SelectByID(sliderId);
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Slider_Delete(Guid sliderId)
        {
            try
            {
                var slider = Repository.SliderRepository.SelectByID(sliderId);

                foreach (var item in slider.SliderOjects.ToList())
                {
                    Repository.SliderObjBaseRepository.Delete(item.SliderObjBaseId);
                }

                Repository.SliderRepository.Delete(sliderId);
                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Slider_EnableDisable(Guid sliderId)
        {
            try
            {
                var slider = Repository.SliderRepository.SelectByID(sliderId);

                if (slider.Enable)
                    slider.Enable = false;
                else slider.Enable = true;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_EnableDisable. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<Slider> Slider_GetAll()
        {
            try
            {
                return Repository.SliderRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_GetAll. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Slider_Update(Slider model)
        {
            try
            {
                Repository.SliderRepository.Update(model);
                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Slider_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Slider ImageSliderObj_Create(ImageSliderObj model)
        {
            try
            {
                var slider = Repository.SliderRepository.SelectByID(model.SliderObjBaseId);

                ImageSliderObj obj = new ImageSliderObj();
                obj.SliderObjBaseId = Guid.NewGuid();
                obj.Top = model.Top;
                obj.Left = model.Left;
                obj.Height = model.Height;
                obj.Width = model.Width;
                obj.Link = model.Link;
                obj.LayerTransitions = model.LayerTransitions;
                obj.Image = model.Image;

                slider.SliderOjects.Add(obj);

                Repository.SliderRepository.Update(slider);
                Repository.Save();

                return slider;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in ImageSliderObj_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Slider VideoSliderObj_Create(VideoSliderObj model)
        {
            try
            {
                var slider = Repository.SliderRepository.SelectByID(model.SliderObjBaseId);

                VideoSliderObj obj = new VideoSliderObj();
                obj.SliderObjBaseId = Guid.NewGuid();
                obj.Top = model.Top;
                obj.Left = model.Left;
                obj.Height = model.Height;
                obj.Width = model.Width;
                obj.Source = model.Source;
                obj.SlideVideoType = model.SlideVideoType;
                obj.LayerTransitions = model.LayerTransitions;

                slider.SliderOjects.Add(obj);

                Repository.SliderRepository.Update(slider);
                Repository.Save();

                return slider;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in VideoSliderObj_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Slider CustomHtmlSliderObj_Create(CustomHtmlSliderObj model)
        {
            try
            {
                var slider = Repository.SliderRepository.SelectByID(model.SliderObjBaseId);

                CustomHtmlSliderObj obj = new CustomHtmlSliderObj();
                obj.SliderObjBaseId = Guid.NewGuid();
                obj.Top = model.Top;
                obj.Left = model.Left;
                obj.InnerHtml = model.InnerHtml;
                obj.LayerTransitions = model.LayerTransitions;

                slider.SliderOjects.Add(obj);

                Repository.SliderRepository.Update(slider);
                Repository.Save();

                return slider;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomHtmlSliderObj_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Slider SliderObj_Delete(Guid sliderObjId)
        {
            try
            {
                var sliderObj = Repository.SliderObjBaseRepository.SelectByID(sliderObjId);

                var slider = sliderObj.Slider;

                if (sliderObj.GetType().BaseType == typeof(ImageSliderObj))
                {
                    var imgSlider = (ImageSliderObj)sliderObj;

                    string fullPath = System.Web.Hosting.HostingEnvironment.MapPath(imgSlider.Image);
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                    }
                }

                Repository.SliderObjBaseRepository.Delete(sliderObjId);
                Repository.Save();

                slider = Repository.SliderRepository.SelectByID(slider.SliderId);

                return slider;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in SliderObj_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public SliderObjBase SliderObj_Get(Guid sliderObjId)
        {
            try
            {
                return Repository.SliderObjBaseRepository.SelectByID(sliderObjId);
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in SliderObj_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void ImageSliderObj_Update(ImageSliderObj model)
        {
            try
            {
                Repository.SliderObjBaseRepository.Update(model);
                Repository.SliderObjBaseRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in ImageSliderObj_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void VideoSliderObj_Update(VideoSliderObj model)
        {
            try
            {
                Repository.SliderObjBaseRepository.Update(model);
                Repository.SliderObjBaseRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in VideoSliderObj_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void CustomHtmlSliderObj_Update(CustomHtmlSliderObj model)
        {
            try
            {
                Repository.SliderObjBaseRepository.Update(model);
                Repository.SliderObjBaseRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomHtmlSliderObj_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<HtmlSnippet> HtmlSnippet_GetAll()
        {
            try
            {
                return Repository.HtmlSnippetsRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in HtmlSnippet_GetAll. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void HtmlSnippet_Update(HtmlSnippet model)
        {
            try
            {
                var snippet = Repository.HtmlSnippetsRepository.FindBy(x => x.HtmlSnippetId.Equals(model.HtmlSnippetId)).Single();

                snippet.Value = model.Value;

                Repository.HtmlSnippetsRepository.Update(snippet);

                Repository.HtmlSnippetsRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in HtmlSnippet_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region CustomUsers

        public List<CustomUser> CustomUser_GetAll()
        {
            try
            {
                return Repository.CustomUserRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomUser_GetAll. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public CustomUser CustomUser_Get(string email)
        {
            try
            {
                return Repository.CustomUserRepository.FindBy(x => x.Email.ToLower().Equals(email.ToLower())).FirstOrDefault();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomUser_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void CustomUser_Create(CustomUser model)
        {
            try
            {
                Repository.CustomUserRepository.Insert(model);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomUser_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void CustomUser_Update(CustomUser model)
        {
            try
            {
                Repository.CustomUserRepository.Update(model);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in CustomUser_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region News

        public List<NewsFeed> NewsFeed_GetList()
        {
            try
            {
                return Repository.NewsFeedRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in NewsFeed_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void News_Create(News model)
        {
            try
            {
                News news = new News();
                news.NewsId = Guid.NewGuid();
                news.Title = model.Title;
                news.Url = model.Url;
                news.Tags = model.Tags;
                news.Image = model.Image;

                Repository.NewsRepository.Insert(news);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in News_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void News_Delete(Guid newsId)
        {
            try
            {
                Repository.NewsRepository.Delete(newsId);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in News_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void News_EnableDisable(Guid newsId)
        {
            try
            {
                var news = Repository.NewsRepository.SelectByID(newsId);

                news.Enable = !news.Enable;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in News_EnableDisable. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<News> News_GetList()
        {
            try
            {
                return Repository.NewsRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in News_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region Workshop

        public List<Workshop> Workshop_GetList()
        {
            try
            {
                return Repository.WorkshopRepository.SelectAll().OrderByDescending(x => x.EventDate).ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Workshop Workshop_Get(Guid workshopId)
        {
            try
            {
                return Repository.WorkshopRepository.SelectByID(workshopId);
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Workshop Workshop_Create(Workshop model)
        {
            try
            {
                Workshop workshop = new Workshop();
                workshop.WorkshopId = Guid.NewGuid();
                workshop.CreationDate = DateTime.Now;

                workshop.Title = model.Title;
                workshop.Description = model.Description;
                workshop.BlogHtml = model.BlogHtml;
                workshop.EventDate = model.EventDate;
                workshop.Published = false;

                workshop.IsExternalEvent = model.IsExternalEvent;
                workshop.ExternalRegistration = model.ExternalRegistration;
                workshop.ExternalRegistrationLink = model.ExternalRegistrationLink;

                workshop.Location = new LocationModels();
                workshop.Location.Name = model.Location.Name;
                workshop.Location.Address = model.Location.Address;
                workshop.Location.Coordinates = model.Location.Coordinates;
                workshop.Location.MaximumSpaces = model.Location.MaximumSpaces;

                Repository.WorkshopRepository.Insert(workshop);
                Repository.WorkshopRepository.Save();

                return workshop;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Workshop Workshop_Update(Workshop model)
        {
            try
            {
                Workshop workshop = Repository.WorkshopRepository.SelectByID(model.WorkshopId);

                workshop.Title = model.Title;
                workshop.Description = model.Description;
                workshop.OnlyHtml = model.OnlyHtml;
                workshop.BlogHtml = model.BlogHtml;
                workshop.EventDate = model.EventDate;
                workshop.Published = model.Published;

                workshop.IsExternalEvent = model.IsExternalEvent;
                workshop.ExternalRegistration = model.ExternalRegistration;
                workshop.ExternalRegistrationLink = model.ExternalRegistrationLink;

                workshop.Location.Name = model.Location.Name;
                workshop.Location.Address = model.Location.Address;
                workshop.Location.Coordinates = model.Location.Coordinates;
                workshop.Location.MaximumSpaces = model.Location.MaximumSpaces;

                Repository.WorkshopRepository.Update(workshop);
                Repository.WorkshopRepository.Save();

                return workshop;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Workshop_Delete(Guid workshopid)
        {
            try
            {
                string WORKSHOPUPLOADFILES = "/Uploads/workshops/";

                string workshopFolder = WORKSHOPUPLOADFILES + workshopid;

                string path = System.Web.Hosting.HostingEnvironment.MapPath(workshopFolder);

                if (System.IO.Directory.Exists(path))
                {
                    System.IO.Directory.Delete(path, true);
                }

                Workshop workshop = Repository.WorkshopRepository.SelectByID(workshopid);

                foreach (var item in workshop.Tracks.ToList())
                {
                    Repository.WorkshopTrackRepository.Delete(item.WorkshopTrackId);
                }

                foreach (var item in workshop.Workshopsubscribed.ToList())
                {
                    foreach (var subItem in item.Feedback.TracksFeedback.ToList())
                    {
                        Repository.TrackFeedBackRepository.Delete(subItem.TrackFeedBackId);
                    }

                    Repository.WorkshopFeedbackRepository.Delete(item.Feedback.WorkshopFeedbackId);

                    Repository.WorkshopUndersignedRepository.Delete(item.WorkshopUndersignedId);
                }

                foreach (var item in workshop.WorkshopFiles.ToList())
                {
                    Repository.WorkshopFileRepository.Delete(item.WorkshopFileId);
                }

                Repository.WorkshopRepository.Delete(workshopid);
                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Workshop_UpdateFiles(Guid workshopId, List<WorkshopFile> workshopFiles)
        {
            try
            {
                Workshop workshop = Repository.WorkshopRepository.SelectByID(workshopId);

                if (workshop.WorkshopFiles == null)
                    workshop.WorkshopFiles = new List<WorkshopFile>();

                foreach (var item in workshopFiles)
                {
                    workshop.WorkshopFiles.Add(item);
                    if (item.FileType == WorkshopFileType.Image)
                        workshop.Image = item.FullPath;
                }

                Repository.WorkshopRepository.Update(workshop);
                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Workshop_UpdateFiles. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #region Track

        public void WorkshopTrack_Create(Guid workshopId, WorkshopTrack model, Guid[] Speakers)
        {
            try
            {
                Workshop workshop = Repository.WorkshopRepository.SelectByID(workshopId);

                DateTime StartTime = workshop.EventDate.Date + model.StartTime.TimeOfDay;
                DateTime EndTime = workshop.EventDate.Date + model.EndTime.TimeOfDay;

                WorkshopTrack track = new WorkshopTrack();
                track.WorkshopTrackId = Guid.NewGuid();
                track.Title = model.Title;
                track.Abstract = model.Abstract;
                track.StartTime = StartTime;
                track.EndTime = EndTime;
                track.Image = model.Image;
                track.Level = model.Level;

                foreach (var item in Speakers)
                {
                    track.Speakers.Add(Repository.SpeakerRepository.SelectByID(item));
                }

                workshop.Tracks.Add(track);

                Repository.WorkshopRepository.Update(workshop);

                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopTrack_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopTrack_Update(WorkshopTrackViewModel model, Guid[] Speakers)
        {
            try
            {
                Workshop workshop = Repository.WorkshopRepository.SelectByID(model.Track.WorkshopId);

                WorkshopTrack track = workshop.Tracks.Where(x => x.WorkshopTrackId.Equals(model.Track.WorkshopTrackId)).Single();

                track.Title = model.Track.Title;
                track.Abstract = model.Track.Abstract;
                track.StartTime = model.Track.StartTime;
                track.EndTime = model.Track.EndTime;
                track.Image = model.Track.Image;
                track.Level = model.Track.Level;

                track.Speakers.Clear();

                foreach (var item in Speakers)
                {
                    track.Speakers.Add(Repository.SpeakerRepository.SelectByID(item));
                }

                Repository.WorkshopRepository.Update(workshop);

                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopTrack_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopTrack_Delete(Guid workshoptrackid)
        {
            try
            {
                Repository.WorkshopTrackRepository.Delete(workshoptrackid);

                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopTrack_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<WorkshopTrack> WorkshopTrack_GetList(Guid workshopId)
        {
            try
            {
                throw new NotImplementedException();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopTrack_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public WorkshopTrack WorkshopTrack_Get(Guid workshoptrackid)
        {
            try
            {
                return Repository.WorkshopTrackRepository.SelectByID(workshoptrackid);
            }

            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopTrack_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region Speakers

        public List<WorkshopSpeaker> WorkshopSpeaker_GetList()
        {
            try
            {
                return Repository.SpeakerRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSpeaker_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public WorkshopSpeaker WorkshopSpeaker_Get(Guid workshopSpeakerId)
        {
            try
            {
                var speaker = Repository.SpeakerRepository.SelectByID(workshopSpeakerId);

                return speaker;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSpeaker_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopSpeaker_Insert(WorkshopSpeaker model)
        {
            try
            {
                Repository.SpeakerRepository.Insert(model);
                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSpeaker_Insert. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopSpeaker_Delete(Guid workshopSpeakerId)
        {
            try
            {
                var speaker = Repository.SpeakerRepository.SelectByID(workshopSpeakerId);

                if (!string.IsNullOrEmpty(speaker.ProfileImage) && !speaker.ProfileImage.ToLower().Contains("http"))
                {
                    string fullPath = System.Web.Hosting.HostingEnvironment.MapPath(speaker.ProfileImage);
                    if (System.IO.File.Exists(fullPath))
                    {
                        System.IO.File.Delete(fullPath);
                    }
                }

                Repository.SpeakerRepository.Delete(workshopSpeakerId);
                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSpeaker_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopSpeaker_Update(WorkshopSpeaker model)
        {
            try
            {
                var speaker = Repository.SpeakerRepository.SelectByID(model.WorkshopSpeakerId);

                if (!string.IsNullOrEmpty(speaker.ProfileImage) && !speaker.ProfileImage.Equals(model.ProfileImage))
                {
                    if (!speaker.ProfileImage.ToLower().Contains("http"))
                    {
                        string fullPath = System.Web.Hosting.HostingEnvironment.MapPath(speaker.ProfileImage);
                        if (System.IO.File.Exists(fullPath))
                        {
                            System.IO.File.Delete(fullPath);
                        }
                    }
                }

                speaker.Name = model.Name;
                speaker.ProfileImage = model.ProfileImage;
                speaker.BlogHtml = model.BlogHtml;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSpeaker_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region Subscribed&Feedback

        public Workshop WorkshopSubscribed(Guid workshopId, CustomUser user)
        {
            try
            {
                var workshop = Repository.WorkshopRepository.SelectByID(workshopId);

                if (workshop.Workshopsubscribed.Where(x => x.User.CustomUserId.Equals(user.CustomUserId)).Count() == 0)
                {
                    WorkshopUndersigned subscribe = new WorkshopUndersigned()
                    {
                        WorkshopUndersignedId = Guid.NewGuid(),
                        SignedDate = DateTime.Now,
                        User = user
                    };

                    workshop.Workshopsubscribed.Add(subscribe);

                    Repository.Save();

                    Repository.NotificationRepository.Insert(new Notification()
                    {
                        NotificationId = Guid.NewGuid(),
                        NotificationTypeId = NotificationType.WorkshopUndersigned,
                        Timestamp = DateTime.Now,
                        User = user,
                        Description = workshop.Title
                    });
                    Repository.Save();
                }

                return workshop;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopSubscribed. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public Workshop WorkshopUnsubscribed(Guid workshopId, CustomUser user)
        {
            try
            {
                var workshop = Repository.WorkshopRepository.SelectByID(workshopId);

                var subscribe = workshop.Workshopsubscribed.Where(x => x.User.CustomUserId.Equals(user.CustomUserId)).FirstOrDefault();

                if (subscribe != null)
                {
                    workshop.Workshopsubscribed.Remove(subscribe);

                    Repository.Save();

                    Repository.NotificationRepository.Insert(new Notification()
                    {
                        NotificationId = Guid.NewGuid(),
                        NotificationTypeId = NotificationType.RemoveUndersigned,
                        Timestamp = DateTime.Now,
                        User = user,
                        Description = workshop.Title
                    });

                    Repository.Save();
                }

                return workshop;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopUnsubscribed. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void WorkshopFeedback_Create(WorkshopUndersigned model, CustomUser user)
        {
            try
            {
                var workshop = Repository.WorkshopRepository.SelectByID(model.Workshop.WorkshopId);

                var subscribe = workshop.Workshopsubscribed.Where(x => x.User.CustomUserId.Equals(user.CustomUserId)).Single();

                if (subscribe.Feedback == null)
                {
                    subscribe.Feedback = new WorkshopFeedback();
                    subscribe.Feedback.WorkshopFeedbackId = Guid.NewGuid();
                }
                subscribe.Feedback.Vote = model.Feedback.Vote;

                subscribe.Feedback.TracksFeedback = new List<TrackFeedBack>();

                foreach (var item in model.Feedback.TracksFeedback)
                {
                    subscribe.Feedback.TracksFeedback.Add(new TrackFeedBack()
                    {
                        TrackFeedBackId = Guid.NewGuid(),
                        WorkshopTrackId = item.WorkshopTrackId,
                        Vote = item.Vote,
                        Workshopsubscribed = subscribe.Feedback
                    });
                }

                Repository.Save();

                Repository.NotificationRepository.Insert(new Notification()
                {
                    NotificationId = Guid.NewGuid(),
                    NotificationTypeId = NotificationType.Feedback,
                    Timestamp = DateTime.Now,
                    User = user,
                    Description = workshop.Title
                });

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in WorkshopFeedback_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region Notification

        public void Notification_Create(Notification notification)
        {
            try
            {
                Repository.NotificationRepository.Insert(notification);
                Repository.WorkshopRepository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Notification_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<Notification> Notification_Get(string userId)
        {
            try
            {
                return Repository.NotificationRepository.SelectAll().OrderByDescending(x => x.Timestamp).Where(x => x.User.CustomUserId.Equals(userId)).Take(5).ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Notification_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #endregion

        #region Blogs

        public List<BlogFeed> BlogFeed_GetList()
        {
            try
            {
                return Repository.BlogFeedRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in BlogFeed_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public List<Blog> Blog_GetList()
        {
            try
            {
                return Repository.BlogRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Blog_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Blog_Create(Blog model)
        {
            try
            {
                Blog blog = new Blog();
                blog.BlogId = Guid.NewGuid();
                blog.Title = model.Title;
                blog.Url = model.Url;
                blog.Tags = model.Tags;
                blog.Image = model.Image;
                blog.Enable = model.Enable;

                Repository.BlogRepository.Insert(blog);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Blog_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Blog_Delete(System.Guid blogId)
        {
            try
            {
                Repository.BlogRepository.Delete(blogId);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Blog_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void Blog_EnableDisable(System.Guid blogId)
        {
            try
            {
                var blog = Repository.BlogRepository.SelectByID(blogId);

                blog.Enable = !blog.Enable;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in Blog_EnableDisable. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion

        #region OfferteLavoro

        public List<OffertaLavoro> OfferteLavoro_GetList()
        {
            try
            {
                return Repository.OfferteLavoroRepository.SelectAll().ToList();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_GetList. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public OffertaLavoro OfferteLavoro_Get(System.Guid offerteLavoroId)
        {
            try
            {
                var offerta = Repository.OfferteLavoroRepository.SelectByID(offerteLavoroId);

                return offerta;
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_Get. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void OfferteLavoro_Create(OffertaLavoro model, CustomUser user)
        {
            try
            {
                OffertaLavoro offerteLavoro = new OffertaLavoro();
                offerteLavoro.OffertaLavoroId = Guid.NewGuid();
                offerteLavoro.CreationDate = DateTime.Now;
                offerteLavoro.Enable = false;
                offerteLavoro.Description = model.Description;
                offerteLavoro.Link = model.Link;
                offerteLavoro.Logo = model.Logo;
                offerteLavoro.Title = model.Title;
                offerteLavoro.User = user;
                offerteLavoro.BlogHtml = model.BlogHtml;
                offerteLavoro.Azienda = model.Azienda;
                offerteLavoro.Luogo = model.Luogo;

                Repository.OfferteLavoroRepository.Insert(offerteLavoro);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_Create. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void OfferteLavoro_Update(OffertaLavoro model)
        {
            try
            {
                var offerteLavoro = Repository.OfferteLavoroRepository.SelectByID(model.OffertaLavoroId);

                offerteLavoro.Description = model.Description;
                offerteLavoro.Link = model.Link;
                offerteLavoro.Logo = model.Logo;
                offerteLavoro.Title = model.Title;
                offerteLavoro.BlogHtml = model.BlogHtml;
                offerteLavoro.Azienda = model.Azienda;
                offerteLavoro.Luogo = model.Luogo;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_Update. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void OfferteLavoro_Delete(System.Guid offerteLavoroId)
        {
            try
            {
                Repository.OfferteLavoroRepository.Delete(offerteLavoroId);

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_Delete. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        public void OfferteLavoro_EnableDisable(System.Guid offerteLavoroId)
        {
            try
            {
                var OfferteLavoro = Repository.OfferteLavoroRepository.SelectByID(offerteLavoroId);

                OfferteLavoro.Enable = !OfferteLavoro.Enable;

                Repository.Save();
            }
            catch (Exception ex)
            {
                string msg = $"Unexpected error in OfferteLavoro_EnableDisable. Error: {ex.Message}";

                logger.Error(msg, ex);

                throw new BusinessErrorException(msg, ex);
            }
        }

        #endregion
    }
}
