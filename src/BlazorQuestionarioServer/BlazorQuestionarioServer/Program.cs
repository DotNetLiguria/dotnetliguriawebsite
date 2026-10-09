using BlazorQuestionarioServer.Data;
using BlazorQuestionarioServer.Service;
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Server.Circuits;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.EntityFrameworkCore;
using DotNetLiguria.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddServiceDefaults(builder.Configuration);
if (builder.Configuration["DOTNET_LIGURIA_ASPIRE"] == "true")
    builder.Services.AddHealthChecks().AddCheck<LocalDatabaseHealthCheck>("sql");

// Add services to the container.
builder.Services.AddRazorPages();

//Standard
//builder.Services.AddServerSideBlazor();

builder.Services.AddServerSideBlazor(
                opt =>
                {
                    //Tempo in cui un circuito disconesso viene lasciato in memoria prima che siano liberate le risorse
                    //Default: 3 minuti
                    opt.DisconnectedCircuitRetentionPeriod = TimeSpan.FromMinutes(1);

                    //Numero massimo di circuiti disconnessi tenuti in memoria
                    //Default: 100
                    opt.DisconnectedCircuitMaxRetained = 50; 

                    //Tempo massimo che il server attende per una operazione asincrona di una funziona javascript
                    //Default: 1 minuto
                    opt.JSInteropDefaultCallTimeout = TimeSpan.FromSeconds(30); 

                }
            );



builder.Services.AddDbContextFactory<ApplicationDbContext>(options =>
            options.UseSqlServer(
                   builder.Configuration.GetConnectionString("DefaultConnection")
                  ).EnableSensitiveDataLogging(builder.Configuration["DOTNET_LIGURIA_ASPIRE"] != "true")
                  .UseLoggerFactory(LoggerFactory.Create(builder => builder.AddConsole())));


builder.Services.AddApplicationInsightsTelemetry();
if (builder.Configuration["DOTNET_LIGURIA_ASPIRE"] == "true")
{
    builder.Services.Configure<Microsoft.ApplicationInsights.Extensibility.TelemetryConfiguration>(
        options => options.DisableTelemetry = true);
}
if (builder.Configuration["DOTNET_LIGURIA_ASPIRE"] == "true")
{
    builder.Services.AddSingleton<CircuitHandler>(services =>
    {
        var meter = services.GetRequiredService<System.Diagnostics.Metrics.IMeterFactory>()
            .Create(new System.Diagnostics.Metrics.MeterOptions("DotNetLiguria.Questionnaire"));
        var circuitCount = meter.CreateHistogram<int>("NumCircuitiAperti");
        return new CountCircuitHandler(TimeProvider.System, (_, count) => circuitCount.Record(count));
    });
}
else
{
    builder.Services.AddSingleton<CircuitHandler, CountCircuitHandler>();
}


var app = builder.Build();
if (builder.Configuration.GetValue<bool>("LocalDevelopment:Initialize"))
{
    await using var context = await app.Services.GetRequiredService<IDbContextFactory<ApplicationDbContext>>()
        .CreateDbContextAsync();
    await LocalDatabaseInitializer.InitializeAsync(context, builder.Configuration, app.Environment, app.Logger);
}

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

//Versione che nn evita fallback in longpolling
app.MapBlazorHub(configureOptions: options =>
{
    options.Transports = HttpTransportType.WebSockets;
});

app.MapFallbackToPage("/_Host");
app.MapServiceDefaults();

app.Run();
