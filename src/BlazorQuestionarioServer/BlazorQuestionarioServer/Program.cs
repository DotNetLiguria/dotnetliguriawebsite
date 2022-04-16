using BlazorQuestionarioServer.Data;
using BlazorQuestionarioServer.Service;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Server.Circuits;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

//Standard
//builder.Services.AddServerSideBlazor();

builder.Services.AddServerSideBlazor(
                opt =>
                {
                    opt.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(1); //Tempo in cui un circuito disconesso viene lasciato in memoria prima che siano liberate le risorse
                    opt.DisconnectedCircuitMaxRetained = 50; //Numero massimo di circuiti disconnessi tenuti in memoria
                    opt.JSInteropDefaultCallTimeout = TimeSpan.FromSeconds(30); //Tempo massimo che il srever attende per una operazione asincrona di una funziona javascript

                }
            );



builder.Services.AddDbContextFactory<ApplicationDbContext>(options =>
            options.UseSqlServer(
                   builder.Configuration.GetConnectionString("DefaultConnection")
                  ).EnableSensitiveDataLogging()
                  .UseLoggerFactory(LoggerFactory.Create(builder => builder.AddConsole())));


builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddSingleton<CircuitHandler, CountCircuitHandler>();


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



//Versione Originale
//app.MapBlazorHub();
//Equivalente al seguente
//app.MapBlazorHub(configureOptions: options =>
//{
//    options.Transports = HttpTransportType.WebSockets | HttpTransportType.LongPolling;
//});

//Versione che nn evita fallback in logpolling
app.MapBlazorHub(configureOptions: options =>
{
    options.Transports = HttpTransportType.WebSockets;
});

app.MapFallbackToPage("/_Host");

app.Run();
