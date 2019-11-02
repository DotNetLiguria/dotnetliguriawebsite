using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity.Validation;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Repository
{
    public class UnitOfWork : IUnitOfWork
    {
        public DotNetLiguriaContext context { get; }

        public UnitOfWork(DotNetLiguriaContext _context)
        {
            context = _context;
        }

        private IGenericRepository<WorkshopSpeaker> speakerRepository;
        public IGenericRepository<WorkshopSpeaker> SpeakerRepository
        {
            get
            {
                if (this.speakerRepository == null)
                {
                    this.speakerRepository = new GenericRepository<WorkshopSpeaker>(context);
                }
                return speakerRepository;
            }
        }

        private IGenericRepository<Blog> blogRepository;
        public IGenericRepository<Blog> BlogRepository
        {
            get
            {
                if (this.blogRepository == null)
                {
                    this.blogRepository = new GenericRepository<Blog>(context);
                }
                return blogRepository;
            }
        }

        private IGenericRepository<News> newsRepository;
        public IGenericRepository<News> NewsRepository
        {
            get
            {
                if (this.newsRepository == null)
                {
                    this.newsRepository = new GenericRepository<News>(context);
                }
                return newsRepository;
            }
        }

        private IGenericRepository<HtmlSnippet> htmlSnippetsRepository;
        public IGenericRepository<HtmlSnippet> HtmlSnippetsRepository
        {
            get
            {
                if (this.htmlSnippetsRepository == null)
                {
                    this.htmlSnippetsRepository = new GenericRepository<HtmlSnippet>(context);
                }
                return htmlSnippetsRepository;
            }
        }

        private IGenericRepository<Workshop> workshopRepository;
        public IGenericRepository<Workshop> WorkshopRepository
        {
            get
            {
                if (this.workshopRepository == null)
                {
                    this.workshopRepository = new GenericRepository<Workshop>(context);
                }
                return workshopRepository;
            }
        }

        private IGenericRepository<Notification> notificationRepository;
        public IGenericRepository<Notification> NotificationRepository
        {
            get
            {
                if (this.notificationRepository == null)
                {
                    this.notificationRepository = new GenericRepository<Notification>(context);
                }
                return notificationRepository;
            }
        }

        private IGenericRepository<NewsFeed> newsFeedRepository;
        public IGenericRepository<NewsFeed> NewsFeedRepository
        {
            get
            {
                if (this.newsFeedRepository == null)
                {
                    this.newsFeedRepository = new GenericRepository<NewsFeed>(context);
                }
                return newsFeedRepository;
            }
        }

        private IGenericRepository<BlogFeed> blogFeedRepository;
        public IGenericRepository<BlogFeed> BlogFeedRepository
        {
            get
            {
                if (this.blogFeedRepository == null)
                {
                    this.blogFeedRepository = new GenericRepository<BlogFeed>(context);
                }
                return blogFeedRepository;
            }
        }

        private IGenericRepository<WorkshopFile> workshopFileRepository;
        public IGenericRepository<WorkshopFile> WorkshopFileRepository
        {
            get
            {
                if (this.workshopFileRepository == null)
                {
                    this.workshopFileRepository = new GenericRepository<WorkshopFile>(context);
                }
                return workshopFileRepository;
            }
        }

        private IGenericRepository<WorkshopTrack> workshopTrackRepository;
        public IGenericRepository<WorkshopTrack> WorkshopTrackRepository
        {
            get
            {
                if (this.workshopTrackRepository == null)
                {
                    this.workshopTrackRepository = new GenericRepository<WorkshopTrack>(context);
                }
                return workshopTrackRepository;
            }
        }

        private IGenericRepository<WorkshopUndersigned> workshopUndersignedRepository;
        public IGenericRepository<WorkshopUndersigned> WorkshopUndersignedRepository
        {
            get
            {
                if (this.workshopUndersignedRepository == null)
                {
                    this.workshopUndersignedRepository = new GenericRepository<WorkshopUndersigned>(context);
                }
                return workshopUndersignedRepository;
            }
        }


        private IGenericRepository<CustomUser> customUserRepository;
        public IGenericRepository<CustomUser> CustomUserRepository
        {
            get
            {
                if (this.customUserRepository == null)
                {
                    this.customUserRepository = new GenericRepository<CustomUser>(context);
                }
                return customUserRepository;
            }
        }

        private IGenericRepository<Slider> sliderRepository;
        public IGenericRepository<Slider> SliderRepository
        {
            get
            {
                if (this.sliderRepository == null)
                {
                    this.sliderRepository = new GenericRepository<Slider>(context);
                }
                return sliderRepository;
            }
        }

        private IGenericRepository<SliderObjBase> sliderObjBaseRepository;
        public IGenericRepository<SliderObjBase> SliderObjBaseRepository
        {
            get
            {
                if (this.sliderObjBaseRepository == null)
                {
                    this.sliderObjBaseRepository = new GenericRepository<SliderObjBase>(context);
                }
                return sliderObjBaseRepository;
            }
        }

        private IGenericRepository<WorkshopFeedback> workshopFeedbackRepository;
        public IGenericRepository<WorkshopFeedback> WorkshopFeedbackRepository
        {
            get
            {
                if (this.workshopFeedbackRepository == null)
                {
                    this.workshopFeedbackRepository = new GenericRepository<WorkshopFeedback>(context);
                }
                return workshopFeedbackRepository;
            }
        }

        private IGenericRepository<TrackFeedBack> trackFeedBackRepository;
        public IGenericRepository<TrackFeedBack> TrackFeedBackRepository
        {
            get
            {
                if (this.trackFeedBackRepository == null)
                {
                    this.trackFeedBackRepository = new GenericRepository<TrackFeedBack>(context);
                }
                return trackFeedBackRepository;
            }
        }

        private IGenericRepository<OffertaLavoro> offerteLavoroRepository;
        public IGenericRepository<OffertaLavoro> OfferteLavoroRepository
        {
            get
            {
                if (this.offerteLavoroRepository == null)
                {
                    this.offerteLavoroRepository = new GenericRepository<OffertaLavoro>(context);
                }
                return offerteLavoroRepository;
            }
        }



        public void Save()
        {
            try
            {
                context.SaveChanges();
            }
            catch (DbEntityValidationException dbEx)
            {
                foreach (var validationErrors in dbEx.EntityValidationErrors)
                {
                    foreach (var validationError in validationErrors.ValidationErrors)
                    {
                        throw new Exception(string.Format("EF Save Errore : Property: {0} Error: {1}", validationError.PropertyName, validationError.ErrorMessage));
                    }
                }
            }
        }

        //private bool disposed = false;

        //protected virtual void Dispose(bool disposing)
        //{
        //    if (!this.disposed)
        //    {
        //        if (disposing)
        //        {
        //            context.Dispose();
        //        }
        //    }
        //    this.disposed = true;
        //}

        //public void Dispose()
        //{
        //    Dispose(true);
        //    GC.SuppressFinalize(this);
        //}
    }
}