using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.Web.RssEngine
{
    public abstract class DataSourceBase<T>
    {
        public abstract Task<IEnumerable<T>> LoadDataAsync();

        public async Task<DateTime> LoadDataAsync(ObservableCollection<T> viewItems, bool forceRefresh)
        {
            DateTime timeStamp = DateTime.Now;

            viewItems = new ObservableCollection<T>(await LoadDataAsync());

            return timeStamp;
        }
    }
}
