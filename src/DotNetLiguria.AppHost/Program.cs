using DotNetLiguria.AppHost;

var builder = DistributedApplication.CreateBuilder(args);
ApplicationResources.Configure(builder);
builder.Build().Run();
