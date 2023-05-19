using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.MongoDBModel
{
    public class Location
    {
        public Location()
        {
            this.Coordinates = "0,0";
        }

        public string? Name { get; set; }
        public string? Coordinates { get; set; }
        public string? Address { get; set; }
        public int MaximumSpaces { get; set; }
    }
}
