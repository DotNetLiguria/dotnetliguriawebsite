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
    public class BlogsJob : IJob
    {
        private UnitOfWork unitOfWork;

        private static Dictionary<string, IEnumerable<RssSchema>> FeedResult = new Dictionary<string, IEnumerable<RssSchema>>();

        public BlogsJob()
        {
            unitOfWork = Repository.Utils.RepositoryFactory.Get<UnitOfWork>();
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

            var blogs = unitOfWork.BlogRepository.SelectAll();

            foreach (var item in blogs)
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

        public void Execute(IJobExecutionContext context)
        {
            var feeds = GetRss(20);

            FeedResult.Clear();

            foreach (var item in unitOfWork.BlogFeedRepository.SelectAll())
            {
                unitOfWork.BlogFeedRepository.Delete(item.Id);
            }

            unitOfWork.Save();

            foreach (var item in feeds.Result)
            {
                BlogFeed blogFeed = new BlogFeed();

                blogFeed.Id = item.Id;
                blogFeed.Name = item.Name;
                blogFeed.Title = item.Title;
                blogFeed.Summary = item.Summary;
                blogFeed.Content = item.Content;
                blogFeed.ImageUrl = item.ImageUrl;
                blogFeed.ExtraImageUrl = item.ExtraImageUrl;
                blogFeed.MediaUrl = item.MediaUrl;
                blogFeed.FeedUrl = item.FeedUrl;
                blogFeed.Author = item.Author;
                blogFeed.PublishDate = item.PublishDate;
                blogFeed.DefaultSummary = item.DefaultSummary;

                unitOfWork.BlogFeedRepository.Insert(blogFeed);
            }

            unitOfWork.Save();
        }
    }
}