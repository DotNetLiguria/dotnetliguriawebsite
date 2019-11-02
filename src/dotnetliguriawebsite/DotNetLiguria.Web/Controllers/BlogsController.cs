using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.Common;
using DotNetLiguria.Web.DAL;
using DotNetLiguria.Web.RssEngine;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;

namespace DotNetLiguria.Web.Controllers
{
    public class BlogsController : BaseController
    {
        public BlogsController(DashboardBusiness _business) : base(_business)
        {

        }

        // GET: RSS
        public ActionResult Index()
        {
            return View();
        }

        public ActionResult BlogsControl()
        {
            var feeds = Business.BlogFeed_GetList();

            return PartialView("BlogsControl", feeds);
        }

        public ActionResult Mini()
        {
            var feeds = Business.BlogFeed_GetList();

            return PartialView("MiniBlogsControl", feeds.Take(3));
        }
    }
}