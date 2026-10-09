using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace BlazorAppTest.Client
{
    public class Startup
    {

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddScoped<StateContainer>();
        }

        public void Configure(WebAssemblyHostBuilder app)
        {
            app.RootComponents.Add<App>("app");
        }
    }
}
