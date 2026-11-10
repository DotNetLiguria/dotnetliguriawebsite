using MongoDB.Bson.Serialization.Attributes;

namespace DotNetLiguriaCore.Model
{
    /// <summary>Optional sections of the public home page. Missing values keep the sections visible.</summary>
    [BsonIgnoreExtraElements]
    public class HomePageSettings
    {
        public const string SingletonId = "home";

        [BsonId]
        public string Id { get; set; } = SingletonId;
        public bool ShowProposeTalk { get; set; } = true;
        public bool ShowFollowUs { get; set; } = true;
    }
}
