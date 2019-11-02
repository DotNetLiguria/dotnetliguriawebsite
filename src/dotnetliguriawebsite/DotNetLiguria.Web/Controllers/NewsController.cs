using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.Common;
using DotNetLiguria.Web.DAL;
using DotNetLiguria.Web.RssEngine;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;

namespace DotNetLiguria.Web.Controllers
{
    public class NewsController : BaseController
    {
        public NewsController(DashboardBusiness _business) : base(_business)
        {
        }

        // GET: RSS
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult Mini()
        {
            var feeds = Business.NewsFeed_GetList();

            return PartialView("MiniNewsControl", feeds.Take(3));
        }

        public ActionResult Popular()
        {
            var feeds = Business.NewsFeed_GetList();

            return PartialView("PopularControl", feeds);
        }

    }
}