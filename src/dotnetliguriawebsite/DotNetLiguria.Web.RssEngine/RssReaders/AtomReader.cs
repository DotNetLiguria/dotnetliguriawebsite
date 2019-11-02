using DotNetLiguria.Web.RssEngine.Common;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Xml.Linq;

namespace DotNetLiguria.Web.RssEngine.RssReaders
{
    internal class AtomReader : BaseRssReader
    {
        /// <summary>
        /// Atom reader implementation to parse Atom content.
        /// </summary>
        /// <param name="doc"></param>
        /// <returns></returns>
        public override ObservableCollection<RssSchema> LoadFeed(XDocument doc)
        {
            try
            {
                var feed = new ObservableCollection<RssSchema>();

                if (doc.Root == null)
                    return feed;

                var items = doc.Root.Elements(doc.Root.GetDefaultNamespace() + "entry").Select(item => GetRssSchema(item)).ToList<RssSchema>();

                feed = new ObservableCollection<RssSchema>(items);

                return feed;
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        private static RssSchema GetRssSchema(XElement item)
        {
            RssSchema rssItem = new RssSchema
            {
                Author = GetItemAuthor(item),
                Title = Utility.DecodeHtml(item.GetSafeElementString("title").Trim()),
                Summary = RssHelper.SanitizeString(Utility.DecodeHtml(GetItemSummary(item)).Trim().Truncate(500, true)),
                Content = GetItemSummary(item),
                ImageUrl = GetItemImage(item),
                PublishDate = item.GetSafeElementDate("published"),
                FeedUrl = item.GetLink("alternate"),
            };

            string id = item.GetSafeElementString("guid").Trim();
            if (string.IsNullOrEmpty(id))
            {
                id = item.GetSafeElementString("id").Trim();
                if (string.IsNullOrEmpty(id))
                {
                    id = rssItem.FeedUrl;
                }
            }
            rssItem.Id = id;
            return rssItem;
        }

        private static string GetItemAuthor(XElement item)
        {
            var content = string.Empty;

            if (item != null && !string.IsNullOrEmpty(item.Element(item.GetDefaultNamespace() + "author").Value))
            {
                content = item.Element(item.GetDefaultNamespace() + "author").GetSafeElementString("name");
            }

            if (string.IsNullOrEmpty(content))
            {
                content = item.GetSafeElementString("author");
            }

            return content;
        }

        private static string GetItemImage(XElement item)
        {
            if (!string.IsNullOrEmpty(item.GetSafeElementString("image")))
                return item.GetSafeElementString("image");

            return item.GetImage();
        }

        private static string GetItemSummary(XElement item)
        {
            var content = item.GetSafeElementString("description");
            if (string.IsNullOrEmpty(content))
            {
                content = item.GetSafeElementString("content");
            }
            if (string.IsNullOrEmpty(content))
            {
                content = item.GetSafeElementString("summary");
            }

            return content;
        }
    }
}
