namespace DotNetLiguria.Models
{

    public class LocationModels
    {
        public LocationModels()
        {
            this.Coordinates = "0,0";
        }

        public string? Name { get; set; }
        public string? Coordinates { get; set; }
        public string? Address { get; set; }
        public int MaximumSpaces { get; set; }
    }

}