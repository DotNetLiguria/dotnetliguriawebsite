using DotNetLiguria.Repository;
using DotNetLiguria.Web.DAL;
using DotNetLiguria.Web.Scheduler;
using DotNetLiguria.Web.Scheduler.Jobs;
using log4net;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;
using System.Web.Http;
using System.Web.Mvc;
using System.Web.Optimization;
using System.Web.Routing;

namespace DotNetLiguria.Web
{
    public class MvcApplication : System.Web.HttpApplication
    {
        readonly ILog _log = LogManager.GetLogger(typeof(MvcApplication));

        //private BackgroundJobServer _backgroundJobServer;

        protected void Application_Start()
        {
            Database.SetInitializer(new DatabaseInitializer());
            AreaRegistration.RegisterAllAreas();
            System.Web.Http.GlobalConfiguration.Configure(WebApiConfig.Register);
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            BundleConfig.RegisterBundles(BundleTable.Bundles);

            log4net.Config.XmlConfigurator.Configure();

            JobScheduler.Start();

            //JobStorage.Current = new SqlServerStorage("DotNetLiguriaContext");

            //_backgroundJobServer = new BackgroundJobServer();

            //using (BlogsJob blogsJob = new BlogsJob())
            //{
            //    RecurringJob.AddOrUpdate("blogs", () => blogsJob.Refresh(), Cron.Minutely);
            //}
        }

        protected void Application_End(object sender, EventArgs e)
        {
            //_backgroundJobServer.Dispose();
        }
    }

    public class DatabaseInitializer : CreateDatabaseIfNotExists<DotNetLiguriaContext>
    {
        protected override void Seed(DotNetLiguriaContext context)
        {
            // Seed code here
        }
    }
}