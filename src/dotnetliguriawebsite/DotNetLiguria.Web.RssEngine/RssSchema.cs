using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Web.RssEngine
{
    /// <summary>
    /// Implementation of the RssSchema class.
    /// </summary>
    public class RssSchema : IEquatable<RssSchema>, IComparable<RssSchema>
    {
        private string _title;
        private string _summary;
        private string _content;
        private string _imageUrl;
        private string _extraImageUrl;
        private string _mediaUrl;
        private string _feedUrl;
        private string _author;
        private DateTime _publishDate;

        public string Name { get; set; }

        public string Id { get; set; }

        public string Title
        {
            get { return _title; }
            set { _title = value; }
        }

        public string Summary
        {
            get { return _summary; }
            set { _summary = value; }
        }

        public string Content
        {
            get { return _content; }
            set { _content = value; }
        }

        public string ImageUrl
        {
            get { return _imageUrl; }
            set { _imageUrl = value; }
        }

        public string ExtraImageUrl
        {
            get { return _extraImageUrl; }
            set { _extraImageUrl = value; }
        }

        public string MediaUrl
        {
            get { return _mediaUrl; }
            set { _mediaUrl = value; }
        }

        public string FeedUrl
        {
            get { return _feedUrl; }
            set { _feedUrl = value; }
        }

        public string Author
        {
            get { return _author; }
            set { _author = value; }
        }

        public DateTime PublishDate
        {
            get { return _publishDate; }
            set { _publishDate = value; }
        }

        public string DefaultTitle
        {
            get { return Title; }
        }

        public string DefaultSummary
        {
            get { return Summary; }
        }

        public string DefaultImageUrl
        {
            get { return ImageUrl; }
        }

        public string DefaultContent
        {
            get { return Content; }
        }

        public string GetValue(string fieldName)
        {
            if (!String.IsNullOrEmpty(fieldName))
            {
                switch (fieldName.ToLower())
                {
                    case "id":
                        return String.Format("{0}", Id);
                    case "title":
                        return String.Format("{0}", Title);
                    case "summary":
                        return String.Format("{0}", Summary);
                    case "content":
                        return String.Format("{0}", Content);
                    case "imageurl":
                        return String.Format("{0}", ImageUrl);
                    case "extraimageurl":
                        return String.Format("{0}", ExtraImageUrl);
                    case "mediaurl":
                        return String.Format("{0}", MediaUrl);
                    case "feedurl":
                        return String.Format("{0}", FeedUrl);
                    case "author":
                        return String.Format("{0}", Author);
                    case "publishdate":
                        return String.Format("{0}", PublishDate);
                    case "defaulttitle":
                        return String.Format("{0}", DefaultTitle);
                    case "defaultsummary":
                        return String.Format("{0}", DefaultSummary);
                    case "defaultimageurl":
                        return String.Format("{0}", DefaultImageUrl);
                    default:
                        break;
                }
            }
            return String.Empty;
        }

        public bool NeedSync(RssSchema other)
        {
            return this.Id == other.Id && (this.Title != other.Title || this.Summary != other.Summary || this.Content != other.Content || this.ImageUrl != other.ImageUrl || this.FeedUrl != other.FeedUrl || this.Author != other.Author || this.PublishDate != other.PublishDate);
        }

        public void Sync(RssSchema other)
        {
            this.Title = other.Title;
            this.Summary = other.Summary;
            this.Content = other.Content;
            this.ImageUrl = other.ImageUrl;
            this.FeedUrl = other.FeedUrl;
            this.Author = other.Author;
            this.PublishDate = other.PublishDate;
        }

        public bool Equals(RssSchema other)
        {
            if (ReferenceEquals(this, other)) return true;
            if (ReferenceEquals(null, other)) return false;

            return this.Id == other.Id;
        }

        public override bool Equals(object obj)
        {
            return Equals(obj as RssSchema);
        }

        public override int GetHashCode()
        {
            return this.Id.GetHashCode();
        }

        public int CompareTo(RssSchema other)
        {
            return -1 * this.PublishDate.CompareTo(other.PublishDate);
        }
    }
}
