using DotNetLiguria.Models;using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Repository;
using Ninject;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using DotNetLiguria.BLL.Interfaces;
using DotNetLiguria.BLL.Implementation;
using DotNetLiguria.Web.Controllers;

namespace DotNetLiguria.Web.Common
{
    public abstract class BaseController : Controller
    {
        protected DashboardBusiness Business { get; set; }

        protected BaseController(DashboardBusiness _business)
        {
            this.Business = _business;  //Repository.Utils.RepositoryFactory.Get<DashboardBusiness>();
        }


        public CustomUser CustomUser
        {
            get
            {
                if (User.Identity.IsAuthenticated)
                {
                    var customUser = Business.CustomUser_Get(User.Identity.Name);

                    if (customUser == null) throw new Exception("User not found");

                    return customUser;
                }

                return null;
            }
        }

        //protected override void Dispose(bool disposing)
        //{
        //    Repository.Dispose();
        //    base.Dispose(disposing);
        //}

        protected override void OnException(ExceptionContext filterContext)
        {
            base.OnException(filterContext);
        }
    }
}