using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using DotNetLiguriaCore.Services.Privacy;
using MongoDB.Bson;
using Xunit;

namespace DotNetLiguriaCore.Tests.Access;

public sealed class SpeakerAccountEndpointContractTests
{
    [Fact]
    public void PrivateOperationAttributionRequiresBothImmutableIdentityFields()
    {
        var account = new AccountReference("https://identity.example/realms/test",
            "22222222-2222-2222-2222-222222222222");
        Assert.Equal(new BsonDocument { { "Issuer", account.Issuer }, { "Subject", account.Subject } },
            MongoSpeakerAccountStore.OperationAccountFilter(account));
    }

    [Fact]
    public void AllEndpointsMaterializeWithDistinctLinkAndCreateAuthority()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddSingleton<SpeakerAccountService>();
        builder.Services.AddSingleton<BoardAccountService>();
        using var app = builder.Build();
        app.MapSpeakerAccountEndpoints();
        app.MapBoardAccountEndpoints();
        var endpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>().ToArray();
        Assert.Equal(7, endpoints.Length);
        Assert.All(endpoints, endpoint => Assert.NotNull(endpoint.RequestDelegate));
        foreach (var endpoint in endpoints.Where(endpoint => endpoint.RoutePattern.RawText!.EndsWith("/link", StringComparison.Ordinal)))
        {
            var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(data => data.Policy).ToArray();
            Assert.Contains("access.users.read", policies);
            Assert.DoesNotContain("access.users.create", policies);
            Assert.DoesNotContain("access.permissions.grant", policies);
        }
        foreach (var endpoint in endpoints.Where(endpoint =>
            endpoint.RoutePattern.RawText!.EndsWith("/create-and-invite", StringComparison.Ordinal) ||
            endpoint.RoutePattern.RawText!.EndsWith("/resend-invitation", StringComparison.Ordinal)))
            Assert.Contains(endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>(), data => data.Policy == "access.users.create");
    }
}
