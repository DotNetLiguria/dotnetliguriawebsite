using DotNetLiguria.Repository;
using DotNetLiguria.Web.Helpers;
using DotNetLiguria.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Mvc;
using DotNetLiguria.Web.Common;
using DotNetLiguria.ViewModels;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.BLL.Implementation;
using Hangfire;

namespace DotNetLiguria.Web.Controllers
{
    public class WorkshopsController : BaseController
    {
        public WorkshopsController(DashboardBusiness _business) : base(_business)
        {

        }

        public ActionResult Index()
        {
            var allWorkshops = Business.Workshop_GetList().Where(x => x.Published == true);

            ViewBag.Years = allWorkshops.Select(x => x.EventDate.Year).Distinct().ToList();

            return View(allWorkshops.Take(5).ToList());
        }

        public ActionResult Filter(int year)
        {
            var allWorkshops = Business.Workshop_GetList().Where(x => x.Published == true);

            ViewBag.Years = allWorkshops.Select(x => x.EventDate.Year).Distinct().ToList();

            var filterWorkshops = allWorkshops.Where(x => x.EventDate.Year == year).ToList();

            return View("Index", filterWorkshops);
        }

        public ActionResult Detail(Guid workshopId)
        {
            var workshop = Business.Workshop_Get(workshopId);

            if (string.IsNullOrEmpty(workshop.Location.Coordinates))
            {
                workshop.Location.Coordinates = "0,0";
            }

            return View(new WorkshopViewModels()
            {
                Workshop = workshop,
                User = User.Identity
            });
        }

        public ActionResult Mini()
        {
            var workshops = Business.Workshop_GetList().Where(x => x.Published == true);

            if (workshops.Count() > 0)
            {
                return PartialView("MiniWorkshopsControl", workshops.OrderByDescending(x => x.EventDate).First());
            }

            return View();
        }

        [Authorize]
        public ActionResult Subscribe(Guid workshopId)
        {
            var workshop = Business.WorkshopSubscribed(workshopId, CustomUser);

            BackgroundJob.Enqueue<MailerService>(x => x.WorkshopSubscribe(workshop.WorkshopId, User.Identity.Name));

            return View("Detail", new WorkshopViewModels()
            {
                Workshop = workshop,
                User = User.Identity
            });
        }

        public string RenderRazorViewToString(string viewName, object model)
        {
            ViewData.Model = model;
            using (var sw = new System.IO.StringWriter())
            {
                var viewResult = ViewEngines.Engines.FindPartialView(ControllerContext,
                                                                         viewName);
                var viewContext = new ViewContext(ControllerContext, viewResult.View,
                                             ViewData, TempData, sw);
                viewResult.View.Render(viewContext, sw);
                viewResult.ViewEngine.ReleaseView(ControllerContext, viewResult.View);
                return sw.GetStringBuilder().ToString();
            }
        }

        [Authorize]
        public ActionResult Unsubscribe(Guid workshopId)
        {
            var workshop = Business.WorkshopUnsubscribed(workshopId, CustomUser);

            BackgroundJob.Enqueue<MailerService>(x => x.WorkshopUnsubscribe(workshop.WorkshopId, User.Identity.Name));

            return View("Detail", new WorkshopViewModels()
            {
                Workshop = workshop,
                User = User.Identity
            });
        }

        [Authorize]
        [HttpPost]
        public ActionResult AddFeedback(WorkshopUndersigned model)
        {
            Business.WorkshopFeedback_Create(model, CustomUser);

            return RedirectToAction("Index");
        }
    }
}