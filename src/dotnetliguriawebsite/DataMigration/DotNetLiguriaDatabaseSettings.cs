using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataMigration
{
    public class DotNetLiguriaDatabaseSettings
    { 
        public string ConnectionString { get; set; } = null!;

        public string DatabaseName { get; set; } = null!;

        public string WokshopCollectionName { get; set; } = null!;
        public string SpeakerCollectionName { get; set; } = null!;
    }
}
