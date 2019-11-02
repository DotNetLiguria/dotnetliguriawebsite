using DotNetLiguria.Models;

namespace DotNetLiguria.Repository
{
    public interface IUnitOfWork
    {
        IGenericRepository<BlogFeed> BlogFeedRepository { get; }
        IGenericRepository<Blog> BlogRepository { get; }
        IGenericRepository<HtmlSnippet> HtmlSnippetsRepository { get; }
        IGenericRepository<NewsFeed> NewsFeedRepository { get; }
        IGenericRepository<News> NewsRepository { get; }
        IGenericRepository<Notification> NotificationRepository { get; }
        IGenericRepository<WorkshopSpeaker> SpeakerRepository { get; }
        IGenericRepository<WorkshopFile> WorkshopFileRepository { get; }
        IGenericRepository<Workshop> WorkshopRepository { get; }
        IGenericRepository<WorkshopTrack> WorkshopTrackRepository { get; }
        IGenericRepository<WorkshopUndersigned> WorkshopUndersignedRepository { get; }
        IGenericRepository<CustomUser> CustomUserRepository { get; }
        IGenericRepository<Slider> SliderRepository { get; }
        IGenericRepository<SliderObjBase> SliderObjBaseRepository { get; }
        IGenericRepository<WorkshopFeedback> WorkshopFeedbackRepository { get; }
        IGenericRepository<TrackFeedBack> TrackFeedBackRepository { get; }
        IGenericRepository<OffertaLavoro> OfferteLavoroRepository { get; }
  
        DotNetLiguriaContext context { get; }

        void Save();
    }
}