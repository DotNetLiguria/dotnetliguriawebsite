using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class QuestionnaireAuthorizationViewTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task LinkedQuestionnaireHintsUseTheStoredEventAndDoNotGrantHistoricalWrites(bool historical)
    {
        var eventId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var questionnaire = new Questionnaire { WorkshopId = eventId };
        var store = new TestAuthorizationResourceStore();
        store.Events[eventId] = new Workshop { WorkshopId = eventId, EventDate = new DateTime(2025, 1, 1) };
        var ids = new[] { "questionnaires.read", "questionnaires.manage" }
            .Concat(historical ? ["events.past.manage"] : Array.Empty<string>()).ToArray();
        var services = new ServiceCollection().AddLogging();
        services.AddPermissionAuthorization();
        services.AddSingleton<IAuthorizationResourceStore>(store);
        services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory(ids));
        services.Configure<PrivacyOptions>(options => options.Issuer = TestPermissionDirectory.Issuer);
        services.AddSingleton<TimeProvider>(new FixedAuthorizationClock(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        await using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var http = new DefaultHttpContext
        {
            RequestServices = scope.ServiceProvider,
            User = TestPermissionDirectory.Principal(ids.Select(value => new Claim("permissions", value)).ToArray()),
        };
        http.Request.Method = "GET";
        http.RequestAborted = TestContext.Current.CancellationToken;
        http.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask, RoutePatternFactory.Parse("/api/Questionnaire"),
            0, new EndpointMetadataCollection(), "questionnaires"));
        await new PermissionOperationFilter().InvokeAsync(new DefaultEndpointFilterInvocationContext(http),
            _ => ValueTask.FromResult<object?>(Results.Ok(new[] { questionnaire })));
        Assert.NotNull(questionnaire.Authorization);
        Assert.True(questionnaire.Authorization.IsPast);
        Assert.Contains("questionnaires.read", questionnaire.Authorization.AllowedActions);
        Assert.Equal(historical, questionnaire.Authorization.AllowedActions.Contains("questionnaires.manage"));
    }
}
