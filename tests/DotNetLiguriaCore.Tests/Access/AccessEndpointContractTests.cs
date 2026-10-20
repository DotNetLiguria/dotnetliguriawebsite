using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Access;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class AccessEndpointContractTests
{
    [Fact]
    public void AccessEndpointsMaterializeIncludingTheDeleteRequestBody()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddSingleton<AccessManagementService>();
        builder.Services.AddSingleton<BoardAccountService>();
        using var app = builder.Build();
        app.MapAccessEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints).OfType<RouteEndpoint>().ToArray();
        Assert.Equal(9, endpoints.Length);
        var revoke = Assert.Single(endpoints, endpoint =>
            endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("DELETE") == true);
        Assert.Equal("/api/admin/access/users/{subject}/permissions/{permissionId}", revoke.RoutePattern.RawText);
        Assert.NotNull(revoke.RequestDelegate);
    }
}
