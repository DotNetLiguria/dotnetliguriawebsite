using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using DotNetLiguria.Models;

namespace DotNetLiguria.BLLInterfaces
{
    public interface IDashboardBusiness
    {
        #region HomeShape

        List<Slider> Slider_GetAll();

        Slider Slider_Get(Guid sliderId);

        void Slider_Create(Slider model);

        void Slider_Update(Slider model);

        void Slider_Delete(Guid sliderId);

        void Slider_EnableDisable(Guid sliderId);

        SliderObjBase SliderObj_Get(Guid sliderObjId);

        Slider ImageSliderObj_Create(ImageSliderObj model);

        Slider VideoSliderObj_Create(VideoSliderObj model);

        Slider CustomHtmlSliderObj_Create(CustomHtmlSliderObj model);

        void ImageSliderObj_Update(ImageSliderObj model);

        void VideoSliderObj_Update(VideoSliderObj model);

        void CustomHtmlSliderObj_Update(CustomHtmlSliderObj model);

        Slider SliderObj_Delete(Guid sliderObjId);

        List<HtmlSnippet> HtmlSnippet_GetAll();

        void HtmlSnippet_Update(HtmlSnippet model);

        #endregion

        #region Blog

        List<BlogFeed> BlogFeed_GetList();
        List<Blog> Blog_GetList();
        void Blog_Create(Blog model);
        void Blog_Delete(System.Guid blogId);
        void Blog_EnableDisable(System.Guid blogId);

        #endregion

        #region News

        List<NewsFeed> NewsFeed_GetList();
        List<News> News_GetList();
        void News_Create(News model);
        void News_Delete(System.Guid newsId);
        void News_EnableDisable(System.Guid newsId);

        #endregion

        #region Workshop

        List<Workshop> Workshop_GetList();
        Workshop Workshop_Get(Guid workshopId);
        Workshop Workshop_Create(Workshop model);
        Workshop Workshop_Update(Workshop model);
        void Workshop_Delete(Guid workshopId);
        void Workshop_UpdateFiles(Guid workshopId, List<WorkshopFile> workshopFiles);
        WorkshopTrack WorkshopTrack_Get(Guid workshoptrackid);
        List<WorkshopTrack> WorkshopTrack_GetList(Guid workshopId);
        void WorkshopTrack_Create(Guid workshopId, WorkshopTrack model, Guid[] Speakers);
        void WorkshopTrack_Update(Guid workshopId, WorkshopTrack model, Guid[] Speakers);
        void WorkshopTrack_Delete(Guid workshoptrackid);
        List<WorkshopSpeaker> WorkshopSpeaker_GetList();
        void WorkshopSpeaker_Insert(WorkshopSpeaker model);
        void WorkshopSpeaker_Update(WorkshopSpeaker model);
        void WorkshopSpeaker_Delete(Guid workshopSpeakerId);
        void Notification_Create(Notification notification);
        List<Notification> Notification_Get(string userId);
        Workshop WorkshopSubscribed(Guid workshopId, CustomUser user);
        Workshop WorkshopUnsubscribed(Guid workshopId, CustomUser user);
        void WorkshopFeedback_Create(WorkshopUndersigned model, CustomUser user);

        #endregion

        #region User

        List<CustomUser> CustomUser_GetAll();
        CustomUser CustomUser_Get(string email);
        void CustomUser_Create(CustomUser model);
        void CustomUser_Update(CustomUser model);

        #endregion

    }
}
