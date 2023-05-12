using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Microsoft.Extensions.Configuration;

namespace DataMigration;

internal class ConfigurationReader
{
    static ConfigurationReader()
    {
        Initialize();
    }

    private static void Initialize()
    {
        var environment = Environment.GetEnvironmentVariable("NETCORE_ENVIRONMENT");
        var builder = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddUserSecrets<Program>()
            .AddEnvironmentVariables();
        Configuration = builder.Build();
    }

    public static IConfigurationRoot? Configuration { get; private set; }

    public static T? Read<T>(string name)
    {
        if (Configuration == null) return default(T);
        return Configuration.GetSection(name).Get<T>();
    }
}
