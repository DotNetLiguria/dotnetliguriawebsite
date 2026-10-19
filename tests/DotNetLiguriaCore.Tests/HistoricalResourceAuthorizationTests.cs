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

public sealed class HistoricalResourceAuthorizationTests
{
    private static readonly Guid _eventId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid _questionnaireId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    [Theory]
    [InlineData(false, 403)]
    [InlineData(true, 204)]
    public async Task ReschedulingAPastEventCannotEvadeItsStoredPeriod(bool historical, int status)
    {
        var proposed = new Workshop { WorkshopId = _eventId, EventDate = new DateTime(2027, 1, 1) };
        Assert.Equal((status, status == 204 ? 1 : 0),
            await InvokeAsync("/api/Workshop/Update/{id}", "PUT", _eventId, historical, proposed));
    }

    [Theory]
    [InlineData(false, 403)]
    [InlineData(true, 204)]
    public async Task DetachingAQuestionnaireStillChecksItsStoredPastEvent(bool historical, int status)
    {
        var proposed = new Questionnaire { QuestionnaireId = _questionnaireId, WorkshopId = null };
        Assert.Equal((status, status == 204 ? 1 : 0),
            await InvokeAsync("/api/Questionnaire/{id:guid}", "PUT", _questionnaireId, historical, proposed));
    }

    [Fact]
    public async Task RawResponseExportNeedsHistoricalAccessButStatisticsDoNot()
    {
        Assert.Equal((403, 0), await InvokeAsync("/api/Questionnaire/{id:guid}/export", "GET", _questionnaireId, false));
        Assert.Equal((204, 1), await InvokeAsync("/api/Questionnaire/{id:guid}/statistics", "GET", _questionnaireId, false));
    }

    [Fact]
    public async Task LinkingANewQuestionnaireToAPastEventRequiresTheModifier()
    {
        Assert.Equal((403, 0), await InvokeAsync("/api/Questionnaire", "POST", null, false,
            new CreateQuestionnaireRequest { WorkshopId = _eventId }));
    }

    [Theory]
    [InlineData(false, 403)]
    [InlineData(true, 204)]
    public async Task TicketConfigurationCannotBypassTheHistoricalModifier(bool historical, int status)
    {
        Assert.Equal((status, status == 204 ? 1 : 0),
            await InvokeAsync("/api/Eventbrite/Configuration/{id:guid}", "PUT", _eventId, historical));
    }

    private static async Task<(int Status, int Writes)> InvokeAsync(string route, string method, Guid? id,
        bool historical, params object[] arguments)
    {
        var store = new TestAuthorizationResourceStore();
        store.Events[_eventId] = new Workshop { WorkshopId = _eventId, EventDate = new DateTime(2025, 1, 1) };
        store.Questionnaires[_questionnaireId] = new Questionnaire { QuestionnaireId = _questionnaireId, WorkshopId = _eventId };
        var ids = new[] { "events.manage", "questionnaires.manage", "questionnaire-responses.export", "questionnaire-results.read" }
            .Concat(historical ? ["events.past.manage"] : Array.Empty<string>()).ToArray();
        var services = new ServiceCollection().AddLogging();
        services.AddPermissionAuthorization();
        services.AddSingleton<IAuthorizationResourceStore>(store);
        services.AddSingleton<IPermissionDirectory>(new TestPermissionDirectory(ids));
        services.Configure<PrivacyOptions>(options => options.Issuer = TestPermissionDirectory.Issuer);
        services.AddSingleton<TimeProvider>(new FixedAuthorizationClock(new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero)));
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        await using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var context = new DefaultHttpContext
        {
            RequestServices = scope.ServiceProvider,
            User = TestPermissionDirectory.Principal(ids.Select(value => new Claim("permissions", value)).ToArray()),
        };
        context.Request.Method = method;
        context.RequestAborted = TestContext.Current.CancellationToken;
        if (id is not null) context.Request.RouteValues["id"] = id.ToString();
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask, RoutePatternFactory.Parse(route), 0,
            new EndpointMetadataCollection(), "resource"));
        var writes = 0;
        var result = await new PermissionOperationFilter().InvokeAsync(
            new DefaultEndpointFilterInvocationContext(context, arguments), _ =>
            {
                writes++;
                return ValueTask.FromResult<object?>(Results.NoContent());
            });
        return (Assert.IsAssignableFrom<IStatusCodeHttpResult>(result).StatusCode!.Value, writes);
    }
}
