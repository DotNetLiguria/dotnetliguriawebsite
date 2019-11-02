using DotNetLiguria.Models;
using DotNetLiguria.Repository;
using DotNetLiguria.Web.Models;
using DotNetLiguria.Web.RssEngine;
using Quartz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;

namespace DotNetLiguria.Web.Scheduler.Jobs
{
    public class NewsJob : IJob
    {
        private UnitOfWork unitOfWork;

        private static Dictionary<string, IEnumerable<RssSchema>> FeedResult = new Dictionary<string, IEnumerable<RssSchema>>();

        public NewsJob()
        {
            unitOfWork = Repository.Utils.RepositoryFactory.Get<UnitOfWork>();

#if debug
            WebRequest.DefaultWebProxy = new WebProxy("172.30.202.6:8080");
            WebRequest.DefaultWebProxy.Credentials = CredentialCache.DefaultNetworkCredentials;
#endif
        }

        protected async Task LoadRss(string key, string url)
        {
            FeedDatasource feeddatasource = new FeedDatasource(url);

            var result = await feeddatasource.LoadDataAsync();

            result.ToList().ForEach(item => item.Name = key);

            FeedResult.Add(key, result);
        }

        protected async Task<IEnumerable<RssSchema>> GetRss(int max)
        {
            Dictionary<string, string> FeedUrls = new Dictionary<string, string>();

            var news = unitOfWork.NewsRepository.SelectAll();

            foreach (var item in news)
            {
                if (item.Enable)
                    FeedUrls.Add(item.Title, item.Url);
            }

            List<Task> allTasks = new List<Task>();

            foreach (var item in FeedUrls.Keys)
            {
                allTasks.Add(LoadRss(item, FeedUrls[item]));
            }

            await Task.WhenAll(allTasks);

            IEnumerable<RssSchema> Result = null;

            List<string> Category = new List<string>();

            foreach (var item in FeedResult.Values)
            {
                if (Result == null) Result = item; else Result = Result.Union(item);

                if (item.Count() > 0) Category.Add(item.FirstOrDefault().Name);
            }

            return Result.OrderByDescending(x => x.PublishDate).Take(max);
        }

        void IJob.Execute(IJobExecutionContext context)
        {
            var feeds = GetRss(20);

            FeedResult.Clear();

            foreach (var item in unitOfWork.NewsFeedRepository.SelectAll())
            {
                unitOfWork.NewsFeedRepository.Delete(item.Id);
            }

            unitOfWork.Save();

            foreach (var item in feeds.Result)
            {
                NewsFeed newsFeed = new NewsFeed();

                newsFeed.Id = Guid.NewGuid().ToString();
                newsFeed.Name = item.Name;
                newsFeed.Title = item.Title;
                newsFeed.Summary = item.Summary;
                newsFeed.Content = item.Content;
                newsFeed.ImageUrl = item.ImageUrl;
                newsFeed.ExtraImageUrl = item.ExtraImageUrl;
                newsFeed.MediaUrl = item.MediaUrl;
                newsFeed.FeedUrl = item.FeedUrl;
                newsFeed.Author = item.Author;
                newsFeed.PublishDate = item.PublishDate;
                newsFeed.DefaultSummary = item.DefaultSummary;

                unitOfWork.NewsFeedRepository.Insert(newsFeed);
            }

            unitOfWork.Save();
        }
    }
}