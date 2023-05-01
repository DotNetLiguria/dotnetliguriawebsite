namespace DataMigration;

internal class Program
{
    static void Main(string[] args)
    {
        var db = ConfigurationReader.Read<DbConfig>("DbConfig");
        Console.WriteLine();

        var mongoDB = ConfigurationReader.Read<DotNetLiguriaDatabaseSettings>("DotNetLiguriaDatabase");

        using var ctx = new DotNetLiguriaContext(db.ConnectionString);
        foreach (var item in ctx.Workshops.OrderBy(w => w.EventDate).ToList())
        {
            Console.WriteLine(item.Title);
        }
    }
}