using DotNetLiguria.Models;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.Common;
using DotNetLiguria.Web.DAL;
using DotNetLiguria.Web.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.ViewModels;
using DotNetLiguria.BLL.Implementation;
using System.Data.Entity.Migrations;
using System.Data.Entity.Infrastructure;
using System.Data.Entity.Migrations.Infrastructure;
using DotNetLiguria.Repository.Migrations;
using DotNetLiguria.Web.Migrations;

namespace DotNetLiguria.Web.Controllers
{
    //[RequireHttps]
    public class HomeController : BaseController
    {
        readonly log4net.ILog logger = log4net.LogManager.GetLogger(System.Reflection.MethodBase.GetCurrentMethod().DeclaringType);

        List<Slider> slider;

        public HomeController(DashboardBusiness _business) : base(_business)
        {

        }

        public ActionResult Index()
        {
            //logger.Debug("Home");

            HomeViewModels model = new HomeViewModels();
            model.Sliders = Business.Slider_GetAll();

            ////ViewBag.LeftShoulder = "<img src=\"http://sqlmag.com/site-files/sqlmag.com/files/uploads/2013/11/Red-gate.jpg\" height=\"120\" width=\"400\">";

            //var snippets = business.HtmlSnippet_GetAll();

            //if (snippets.Count() > 0)
            //{
            //    var leftShoulder = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.LeftShoulder.ToString())).Single();

            //    ViewBag.LeftShoulder = leftShoulder.Value;

            //    var rightShoulder = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.RightShoulder.ToString())).Single();

            //    ViewBag.RightShoulder = rightShoulder.Value;
            //}

            return View(model);
        }

        public ActionResult About()
        {
            ViewBag.Message = "Your application description page.";

            return View();
        }

        public ActionResult Contact()
        {
            ViewBag.Message = "Your contact page.";

            return View();
        }

        public ActionResult Snippet(string section)
        {
            var snippets = Business.HtmlSnippet_GetAll();

            string contentString = "<p>A problem with section</p>";

            if (!string.IsNullOrEmpty(section))
            {
                if (section.Equals(SectionName.RightShoulder.ToString()))
                {
                    if (snippets.Count() > 0)
                    {
                        var rightShoulder = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.RightShoulder.ToString())).Single();

                        contentString = RenderSnippetStringToHtml(rightShoulder.Value);
                    }
                }
                else if (section.Equals(SectionName.LeftShoulder.ToString()))
                {
                    if (snippets.Count() > 0)
                    {
                        var leftShoulder = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.LeftShoulder.ToString())).Single();

                        contentString = RenderSnippetStringToHtml(leftShoulder.Value);
                    }
                }
                else if (section.Equals(SectionName.CenterTop.ToString()))
                {
                    if (snippets.Count() > 0)
                    {
                        var centerHead = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.CenterTop.ToString())).Single();

                        contentString = RenderSnippetStringToHtml(centerHead.Value);
                    }
                }
                else if (section.Equals(SectionName.CenterMiddle.ToString()))
                {
                    if (snippets.Count() > 0)
                    {
                        var centerHead = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.CenterMiddle.ToString())).Single();

                        contentString = RenderSnippetStringToHtml(centerHead.Value);
                    }
                }
                else if (section.Equals(SectionName.CenterBottom.ToString()))
                {
                    if (snippets.Count() > 0)
                    {
                        var centerHead = snippets.Where(x => x.HtmlSnippetId.Equals(SectionName.CenterBottom.ToString())).Single();

                        contentString = RenderSnippetStringToHtml(centerHead.Value);
                    }
                }
            }

            return Content(contentString);
        }

        string RenderSnippetStringToHtml(string snippet)
        {
            if (snippet != null)
            {
                if (snippet.Contains("@View:"))
                {
                    int start = snippet.IndexOf("@View:");
                    int end = snippet.IndexOf(",");
                    var view = snippet.Substring(start, end - start).Replace("@View:", "");
                    return RenderRazorViewToString(view, "http://www.w3schools.com/aspnet/27.jpg");
                }
                else return snippet;
            }

            return null;
        }

        string RenderRazorViewToString(string viewName, object model)
        {
            ViewData.Model = model;
            using (var sw = new StringWriter())
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

        //public ActionResult Migration()
        //{
        //    try
        //    {
        //        logger.Info("Migration Command");

        //        Business.Migration();

        //        //Repository.Utils.RepositoryFactory.Get<UnitOfWork>().context.Migration();
        //        //Repository.DotNetLiguriaContext.Migration();

        //        return RedirectToAction("Index", "Home");
        //    }
        //    catch (Exception exc)
        //    {
        //        logger.Error(exc);
        //        throw exc;
        //    }
        //}

        public ActionResult Migration()
        {
            logger.Info("Migration Command");

            using (var context = new DotNetLiguriaContext())
            {
                context.Migration();
            }

            logger.Info("Migration Successful");

            return RedirectToAction("Index", "Home");
        }


        public ActionResult Slider()
        {
            return PartialView("_SlidersControl", slider);
        }
    }
}