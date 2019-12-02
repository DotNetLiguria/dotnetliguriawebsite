using Microsoft.AspNetCore.Components.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace BlazorAppTest.Client
{
    public class Startup
    {

        IServiceCollection _services;
        public void ConfigureServices(IServiceCollection services)
        {
            _services = services;
            services.AddScoped<StateContainer>();
        }

        public void Configure(IComponentsApplicationBuilder app)
        {
            
            app.AddComponent<App>("app");
        }
    }
}
