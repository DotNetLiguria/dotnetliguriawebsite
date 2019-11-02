using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DotNetLiguria.ViewModels
{
    public class WorkshopViewModels
    {
        public WorkshopViewModels()
        {

        }

        public Workshop Workshop { get; set; }

        public System.Security.Principal.IIdentity User { get; set; }

        public bool ShowSubscribe()
        {
            if (Workshop.EventDate > DateTime.Now && User.IsAuthenticated && Workshop.Location.MaximumSpaces > Workshop.Workshopsubscribed.Count())
            {
                var undersigned = Workshop.Workshopsubscribed.Where(x => x.User.Email.Equals(User.Name));

                if (undersigned.Count() == 0) return true;
            }

            return false;
        }

        public bool ShowUnsubscribe()
        {
            if (User.IsAuthenticated)
            {
                var undersigned = Workshop.Workshopsubscribed.Where(x => x.User.Email.Equals(User.Name)).FirstOrDefault();

                if (undersigned != null && !undersigned.CheckIn) return true;
            }

            return false;
        }

        public bool ShowFeedback()
        {
            if (User.IsAuthenticated && !Workshop.IsExternalEvent)
            {
                var undersigned = Workshop.Workshopsubscribed.Where(x => x.User.Email.Equals(User.Name)).FirstOrDefault();

                if (undersigned != null && undersigned.CheckIn && undersigned.Feedback == null) return true;
            }

            return false;
        }

        public List<WorkshopFile> Files
        {
            get
            {
                return Workshop.WorkshopFiles.Where(x => x.FileType == WorkshopFileType.Material).ToList();
            }
        }

        public List<WorkshopFile> Photos
        {
            get
            {
                return Workshop.WorkshopFiles.Where(x => x.FileType == WorkshopFileType.Photo).ToList();
            }
        }
    }
}