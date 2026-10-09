using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace BlazorAppTest.Server
{
    public class Program
    {
        public static void Main(string[] args)
        {
            using var host = BuildWebHost(args);
            var configuration = host.Services.GetRequiredService<IConfiguration>();
            if (configuration.GetValue<bool>("LocalDevelopment:Initialize"))
            {
                using var scope = host.Services.CreateScope();
                LocalDatabaseInitializer.InitializeAsync(
                    scope.ServiceProvider.GetRequiredService<ApplicationDbContexts>(), configuration,
                    host.Services.GetRequiredService<IWebHostEnvironment>(),
                    host.Services.GetRequiredService<Microsoft.Extensions.Logging.ILogger<Program>>())
                    .GetAwaiter().GetResult();
            }
            host.Run();
        }

        public static IWebHost BuildWebHost(string[] args)
        {
            var mainAssembly = typeof(Program).Assembly.GetName().Name; // BlazorAppTest.Server
            mainAssembly = mainAssembly.Replace(".", "").Replace("-", "");
            var configEnv = $"{mainAssembly}Config";
            Console.WriteLine($"Looking for {configEnv}");
            var deployfile = Environment.GetEnvironmentVariable("DOTNET_LIGURIA_ASPIRE") == "true"
                ? null : Environment.GetEnvironmentVariable(configEnv);
            Console.WriteLine($"Found extra config: {deployfile}");
            // deployfile string is a full path to an additional configuration like:
            // "/home/username/edp/BlazorAppTest.Server.json"

            return WebHost.CreateDefaultBuilder(args)
                .UseKestrel(options =>
                {
                    if (deployfile != null)
                    {
                        options.ConfigureEndpoints();
                    }
                })
                .ConfigureAppConfiguration((hostingContext, config) =>
                {
                    if (deployfile != null)
                    {
                        config.AddJsonFile(deployfile, optional: true, reloadOnChange: true);
                    }
                })
                .UseConfiguration(new ConfigurationBuilder()
                    .AddCommandLine(args)
                    .Build())
                .UseStartup<Startup>()
                .Build();
        }
    }
}
