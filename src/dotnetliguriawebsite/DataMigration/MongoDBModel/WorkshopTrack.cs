﻿using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DotNetLiguria.MongoDBModel
{
    public class WorkshopTrack
    {
        [BsonId]
        public Guid WorkshopTrackId { get; set; }

        public string? Title { get; set; }
        public string? Image { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? Abstract { get; set; }
        public int Level { get; set; }

        public List<Guid>? Speakers { get; set; }
    }
}
