namespace DotNetLiguria.AppHost;

public static class ApplicationResources
{
    public static void Configure(IDistributedApplicationBuilder builder)
    {
        var root = Path.GetFullPath(Path.Combine(builder.AppHostDirectory, "..", ".."));
        var mongo = builder.AddMongoDB("mongo")
            .WithImageTag("8.0.32")
            .WithLifetime(ContainerLifetime.Persistent)
            .WithDataVolume("dotnetliguria-aspire-mongo");
        var websiteDatabase = mongo.AddDatabase("website-data", "DotNetLiguriaAspire");

        var website = builder.AddProject<Projects.DotNetLiguriaCore>("website", options =>
            {
                options.ExcludeLaunchProfile = true;
                options.ExcludeKestrelEndpoints = true;
            })
            .WithHttpsEndpoint(port: 5443)
            .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
            .WithEnvironment("DOTNET_LIGURIA_ASPIRE", "true")
            .WithEnvironment("ProfilePhotos__Enabled", "true")
            .WithEnvironment("ProfilePhotos__Root", builder.Configuration["ProfilePhotos:Root"] ??
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "DotNetLiguria", "ProfilePhotos"))
            .WithEnvironment("ASPNETCORE_HOSTINGSTARTUPEXCLUDEASSEMBLIES",
                "Microsoft.WebTools.ApiEndpointDiscovery"
                // Comment out the next line to re-enable Browser Link in Chrome.
                + ";Microsoft.WebTools.BrowserLink.Net")
            .WithEnvironment("DotNetLiguriaDatabase__ConnectionString", websiteDatabase)
            .WithEnvironment("DotNetLiguriaDatabase__DatabaseName", "DotNetLiguriaAspire")
            .WithReference(websiteDatabase)
            .WaitFor(websiteDatabase)
            .WithHttpHealthCheck("/health");

        foreach (var key in new[] { "Authority", "ClientId", "Audience", "MetadataAddress", "ClientSecret" })
        {
            if (!string.IsNullOrWhiteSpace(builder.Configuration[$"AuthServer:{key}"]))
            {
                var parameter = builder.AddParameter($"auth-{key.ToLowerInvariant()}",
                    builder.Configuration[$"AuthServer:{key}"]!, secret: key == "ClientSecret");
                website.WithEnvironment($"AuthServer__{key}", parameter);
            }
        }

        var spa = builder.AddViteApp("spa", Path.Combine(root, "src", "dotnetliguriaspa"), runScriptName: "start")
            .WithNpm(installCommand: "ci")
            .WithEndpoint("http", endpoint => endpoint.Port = 3443)
            .WithEnvironment("VITE_API_BASE_URL",
                ReferenceExpression.Create($"{website.GetEndpoint("https")}/api"))
            .WithEnvironment("VITE_API_URL",
                ReferenceExpression.Create($"{website.GetEndpoint("https")}/api"))
            .WithReference(website)
            .WaitFor(website);

#pragma warning disable ASPIRECERTIFICATES001
        spa.WithHttpsDeveloperCertificate();
#pragma warning restore ASPIRECERTIFICATES001

        if (!string.IsNullOrWhiteSpace(builder.Configuration["AuthServer:Authority"]))
            spa.WithEnvironment("VITE_OIDC_AUTHORITY", builder.Configuration["AuthServer:Authority"]!);
        if (!string.IsNullOrWhiteSpace(builder.Configuration["Spa:ClientId"]))
            spa.WithEnvironment("VITE_OIDC_CLIENT_ID", builder.Configuration["Spa:ClientId"]!);
    }
}
