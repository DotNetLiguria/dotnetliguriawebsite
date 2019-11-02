using System;
using System.IO;
using System.IO.Compression;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Xml.Linq;
using System.Net.Http;

namespace DotNetLiguria.Web.RssEngine.RssReaders
{
    /// <summary>
    /// Rss data provider class
    /// </summary>
    public class RssDataProvider
    {
        private Uri _uri;
        private string _userAgent;

        /// <summary>
        /// Constructor.
        /// </summary>
        /// <param name="url"></param>
        public RssDataProvider(string url, string userAgent = null)
        {
            _uri = new Uri(url);
            _userAgent = userAgent;
        }

        /// <summary>
        /// Starts loading the feed and initializing the reader for the feed type.
        /// </summary>
        /// <returns></returns>
        public async Task<ObservableCollection<RssSchema>> Load()
        {
            string xmlContent = await DownloadAsync();

            var doc = XDocument.Parse(xmlContent);
            var type = BaseRssReader.GetFeedType(doc);

            BaseRssReader rssReader;
            if (type == RssType.Rss)
                rssReader = new RssReader();
            else
                rssReader = new AtomReader();

            return rssReader.LoadFeed(doc);
        }

        private async Task<string> DownloadAsync()
        {
            //HttpClientHandler aHandler = new HttpClientHandler();
            //System.Net.IWebProxy proxy = new System.Net.WebProxy(new Uri("172.30.202.6:8080"));
            //proxy.Credentials = new System.Net.NetworkCredential("swqa\\marco.dalessandro", "1234\\qwer");
            //aHandler.Proxy = proxy;
            //var client = new HttpClient(aHandler);

            var client = new HttpClient();

            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, _uri);
            if (!string.IsNullOrEmpty(_userAgent))
            {
                request.Headers.UserAgent.ParseAdd(_userAgent);
            }

            System.Net.WebRequest.DefaultWebProxy.Credentials = System.Net.CredentialCache.DefaultCredentials;
            
            HttpResponseMessage responseMessage = await client.SendAsync(request);

            using (var stream = await responseMessage.Content.ReadAsStreamAsync())
            {
                using (var memStream = new MemoryStream())
                {
                    // Note: Some RSS feeds return gzipped data even when they are not requested to.
                    // This code check if data is gzipped and unzip data if needed.

                    await stream.CopyToAsync(memStream);
                    byte[] buffer = memStream.ToArray();
                    memStream.Position = 0;

                    if (buffer[0] == 31 && buffer[1] == 139 && buffer[2] == 8)
                    {
                        using (var gzipStream = new GZipStream(memStream, CompressionMode.Decompress))
                        {
                            return ReadStream(gzipStream);
                        }
                    }
                    else
                    {
                        return ReadStream(memStream);
                    }
                }
            }
        }

        private string ReadStream(Stream stream)
        {
            using (var reader = new StreamReader(stream))
            {
                return reader.ReadToEnd();
            }
        }
    }
}
