using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.MongoDBModel
{
    public class WorkshopSpeaker
    {
        [BsonId]
        public Guid WorkshopSpeakerId { get; set; }

        public string? Name { get; set; }
        public string? ProfileImage { get; set; }
        public string? BlogHtml { get; set; }
        public string? UserName { get; set; }
    }
}
