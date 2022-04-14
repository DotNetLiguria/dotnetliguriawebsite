using BlazorQuestionarioServer.Data;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

//Standard
builder.Services.AddServerSideBlazor();

//builder.Services.AddServerSideBlazor(
//    options => {
//        options.DisconnectedCircuitMaxRetained = 100;
//        options.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(3);
//    }

//    );



builder.Services.AddDbContextFactory<ApplicationDbContext>(options =>
            options.UseSqlServer(
                   builder.Configuration.GetConnectionString("DefaultConnection")
                  ).EnableSensitiveDataLogging()
                  .UseLoggerFactory(LoggerFactory.Create(builder => builder.AddConsole())));


var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

//app.MapBlazorHub();

//Questo è il default
//app.MapBlazorHub(configureOptions: options =>
//{
//    options.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
//});

//Versione che nn permette fallback in logpolling
app.MapBlazorHub(configureOptions: options =>
{
    options.Transports = HttpTransportType.WebSockets;
});

app.MapFallbackToPage("/_Host");

app.Run();
