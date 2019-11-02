using DotNetLiguria.Web.RssEngine.RssReaders;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Web.RssEngine
{
    public class FeedDatasource : DataSourceBase<RssSchema>
    {
        private string _url;

        public FeedDatasource(string url)
        {
            _url = url;
        }

        public async override Task<IEnumerable<RssSchema>> LoadDataAsync()
        {
            try
            {
                var rssDataProvider = new RssDataProvider(_url);
                return await rssDataProvider.Load();
            }
            catch (Exception ex)
            {
                return new RssSchema[0];
            }
        }
    }
}
