using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.JavaScript;
using DotNetLiguria.AppHost;
using Xunit;

namespace RepositoryRules.Tests;

public class AspireTopologyTests
{
    [Fact]
    public void OneHostOrchestratesFourApplicationsAndOnlyRequiredStorage()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        var builder = DistributedApplication.CreateBuilder(new DistributedApplicationOptions
        {
            ProjectDirectory = Path.Combine(directory.FullName, "src", "DotNetLiguria.AppHost"),
            AssemblyName = typeof(ApplicationResources).Assembly.FullName,
            DisableDashboard = true
        });
        ApplicationResources.Configure(builder);
        Assert.Equal(new[] { "hosted-questionnaire", "mongo", "questionnaire-data", "server-questionnaire",
            "spa", "sql", "website", "website-data" },
            builder.Resources.Where(resource => resource is ProjectResource or ContainerResource
                or MongoDBDatabaseResource or SqlServerDatabaseResource or ViteAppResource)
                .Select(resource => resource.Name).Order().ToArray());
        Assert.DoesNotContain(builder.Resources, resource => resource.Name.Contains("migration", StringComparison.OrdinalIgnoreCase));
        var website = Assert.Single(builder.Resources, resource => resource.Name == "website");
        Assert.Equal(5443, Assert.Single(website.Annotations.OfType<EndpointAnnotation>(),
            endpoint => endpoint.Name == "https").Port);
        var spa = Assert.Single(builder.Resources, resource => resource.Name == "spa");
        Assert.Equal(3443, Assert.Single(spa.Annotations.OfType<EndpointAnnotation>()).Port);
        foreach (var project in builder.Resources.OfType<ProjectResource>())
        {
            Assert.Single(project.Annotations.OfType<ExcludeLaunchProfileAnnotation>());
            var endpoint = Assert.Single(project.Annotations.OfType<EndpointAnnotation>());
            Assert.Equal("https", endpoint.UriScheme);
        }
        Assert.Equal(2, builder.Resources.Sum(resource =>
            resource.Annotations.OfType<ContainerMountAnnotation>().Count(mount => mount.Type == ContainerMountType.Volume)));
    }
}
