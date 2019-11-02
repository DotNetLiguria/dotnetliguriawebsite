using DotNetLiguria.Web.Scheduler.Jobs;
using Quartz;
using Quartz.Impl;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DotNetLiguria.Web.Scheduler
{
    public class JobScheduler
    {
        static readonly log4net.ILog logger = log4net.LogManager.GetLogger("Scheduler");

        public static void Start()
        {
            logger.Info("JobScheduler started");

            IScheduler scheduler = StdSchedulerFactory.GetDefaultScheduler();
            scheduler.Start();

            #region News

            IJobDetail jobNews = JobBuilder.Create<NewsJob>()
                .Build();

            ITrigger triggerNews = TriggerBuilder.Create()
              .StartNow()
              .WithSimpleSchedule
                  (s =>
                     s.WithIntervalInSeconds(300) //s.WithIntervalInHours(1)
                     .RepeatForever()
                     )
              .Build();

            scheduler.ScheduleJob(jobNews, triggerNews);

            #endregion

            #region Blog

            IJobDetail jobBlog = JobBuilder.Create<BlogsJob>()
                .Build();

            ITrigger triggerBlog = TriggerBuilder.Create()
              .StartNow()
              .WithSimpleSchedule
                  (s =>
                     s.WithIntervalInSeconds(300) //s.WithIntervalInHours(1)
                     .RepeatForever()
                     )
              .Build();

            scheduler.ScheduleJob(jobBlog, triggerBlog);

            #endregion

            logger.InfoFormat("JobScheduler now: {0}", DateTime.Now.ToString());


        }
    }
}