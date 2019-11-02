using DotNetLiguria.Repository;
using DotNetLiguria.Web.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.BLL.Implementation;

namespace DotNetLiguria.Web.Controllers
{
    public class UserController : BaseController
    {
        public UserController(DashboardBusiness _business) : base(_business)
        {

        }

        // GET: User
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult UpcomingEvents()
        {
            var events = Business.Workshop_GetList().Where(x => x.EventDate > DateTime.Now).OrderByDescending(x => x.EventDate).Take(5).ToList();

            return PartialView("_UpcomingEvents", events);
        }

        public ActionResult Notification()
        {
            var notifications = Business.Notification_Get(CustomUser.CustomUserId);

            return PartialView("_Notification", notifications);
        }

        public ActionResult YourEvents()
        {
            var yourEvents = Business.Workshop_GetList().Where(x => x.Workshopsubscribed.Any(y => y.User == CustomUser)).OrderByDescending(x => x.EventDate).Take(5).ToList();

            return PartialView("_YourEvents", yourEvents);
        }

    }
}