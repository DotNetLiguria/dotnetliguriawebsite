using DotNetLiguria.Web.RssEngine;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Web;
using System.Web.Mvc;
using System.Xml;

namespace DotNetLiguria.Web.Controllers
{
    public class RSSController : Controller
    {
        Dictionary<string, IEnumerable<RssSchema>> FeedResult = new Dictionary<string, IEnumerable<RssSchema>>();

        // GET: RSS
        public async Task<ActionResult> Index()
        {
            Dictionary<string, string> FeedUrls = new Dictionary<string, string>();

            //FeedUrls.Add("windowsteca", "http://www.windowsteca.net/feed/");
            //FeedUrls.Add("downloadblog", "http://www.downloadblog.it/rss2.xml");
            //FeedUrls.Add("plaffo", "http://www.plaffo.com/feed/");

            //FeedUrls.Add("aspitalia", "http://feed.aspitalia.com/feed.xml");

            FeedUrls.Add("Jerry Nixon", "http://blogs.msdn.com/b/jerrynixon/rss.aspx");
        
            List<Task> allTasks = new List<Task>();

            foreach (var item in FeedUrls.Keys)
            {
                allTasks.Add(LoadRss(item, FeedUrls[item]));
            }

            await Task.WhenAll(allTasks);

            IEnumerable<RssSchema> Result = null;

            foreach (var item in FeedResult.Values)
            {
                if (Result == null) Result = item; else Result = Result.Union(item);
            }

            return View(Result.OrderByDescending(x => x.PublishDate).Take(10));
        }

        public async Task LoadRss(string key, string url)
        {
            FeedDatasource feeddatasource = new FeedDatasource(url);

            var result = await feeddatasource.LoadDataAsync();

            result.ToList().ForEach(item => item.Name = key);

            FeedResult.Add(key, result);
        }
    }


    //for download imahe from feedly
    //            string urlImg;

    //            using (var client = new HttpClient())
    //            {
    //                client.BaseAddress = new Uri("http://img.feedly.com/img");
    //                client.DefaultRequestHeaders.Accept.Clear();
    //                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

    //                var link = item.Links[0].Uri.AbsoluteUri;

    //                var response = client.GetAsync("?url=" + link).Result;

    //                ImageUrlModel image = (ImageUrlModel)JsonConvert.DeserializeObject(response.Content.ReadAsStringAsync().Result, typeof(ImageUrlModel));

    //                urlImg = image.url;
    //            }

    //public class ImageUrlModel
    //{
    //    public string url;
    //}

}