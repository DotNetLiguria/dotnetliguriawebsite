using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Repository;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace DotNetLiguria.Web.Helpers
{
    public class SpeakersHelper
    {
        public static List<SelectListItem> GetSpeakers
        {
            get
            {
                IUnitOfWork unitOfWork = Repository.Utils.RepositoryFactory.Get<UnitOfWork>();

                var allspeakers = unitOfWork.SpeakerRepository.SelectAll().ToList();

                List<SelectListItem> speakers = new List<SelectListItem>();

                foreach (var item in allspeakers)
                {
                    speakers.Add(new SelectListItem()
                    {
                        Value = item.WorkshopSpeakerId.ToString(),
                        Text = item.Name
                    });
                }

                return speakers;
            }

        }
    }
}