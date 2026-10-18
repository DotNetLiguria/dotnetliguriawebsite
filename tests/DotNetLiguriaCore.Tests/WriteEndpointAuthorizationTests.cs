using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WriteEndpointAuthorizationTests
{
    [Fact]
        public void WriteEndpointsRequireTheirRoleSpecificAdminPolicy()
    {
            using var app = CreateApp();
            var writeEndpoints = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints)
                .OfType<RouteEndpoint>()
                .Where(endpoint => endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods
                    .Any(method => method is "POST" or "PUT" or "PATCH" or "DELETE") == true)
                .ToArray();

            Assert.NotEmpty(writeEndpoints);
            Assert.All(writeEndpoints.Where(endpoint => !Route(endpoint).StartsWith("/api/PublicQuestionnaire/", StringComparison.Ordinal)),
                endpoint =>
            {
                var authorization = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
                Assert.NotEmpty(authorization);
                var expectedPolicy = Route(endpoint).StartsWith("/api/Questionnaire", StringComparison.Ordinal)
                    ? QuestionnaireAuthorizationOptions.PolicyName
                    : Route(endpoint).StartsWith("/api/Backup", StringComparison.Ordinal) ||
                      Route(endpoint) == "/api/Speaker/RepairLegacyTrackReferences"
                        ? BackupAuthorizationOptions.PolicyName
                        : WebDevAdminAuthorizationOptions.PolicyName;
                Assert.Contains(authorization, data => data.Policy == expectedPolicy);
            });

            var publicSubmission = Assert.Single(writeEndpoints, endpoint =>
                Route(endpoint) == "/api/PublicQuestionnaire/{id:guid}/responses");
            Assert.NotNull(publicSubmission.Metadata.GetMetadata<IAllowAnonymous>());
            Assert.Empty(publicSubmission.Metadata.GetOrderedMetadata<IAuthorizeData>());
        }

        [Fact]
        public async Task PrivacyAndNotificationRoutesAreBearerOnlyExceptConfirmedUnsubscribe()
        {
            using var app = CreateApp();
            app.MapPrivacyEndpoints();
            app.MapNotificationEndpoints();
            var routes = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints)
                .OfType<RouteEndpoint>().Where(endpoint => Route(endpoint).StartsWith("/api/privacy") ||
                    Route(endpoint).StartsWith("/api/notifications")).ToArray();
            Assert.NotEmpty(routes);
            var policies = app.Services.GetRequiredService<IAuthorizationPolicyProvider>();
            foreach (var endpoint in routes)
            {
                if (Route(endpoint).Contains("/unsubscribe/"))
                {
                    Assert.NotNull(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
                    continue;
                }
                Assert.Null(endpoint.Metadata.GetMetadata<IAllowAnonymous>());
                var authorization = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
                Assert.NotEmpty(authorization);
                var bearer = authorization.Any(data => data.AuthenticationSchemes == "Bearer");
                foreach (var policy in authorization.Where(data => !string.IsNullOrEmpty(data.Policy)))
                    bearer |= (await policies.GetPolicyAsync(policy.Policy!))?.AuthenticationSchemes.Contains("Bearer") == true;
                Assert.True(bearer, Route(endpoint));
            }
        }

        [Fact]
        public void EndpointMappingPreservesTheControllerRouteShapes()
        {
            using var app = CreateApp();
            var routes = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints)
                .OfType<RouteEndpoint>()
                .Select(Route)
                .ToHashSet(StringComparer.Ordinal);

            Assert.Contains("/WeatherForecast", routes);
            Assert.Contains("/api/Backup/import", routes);
            Assert.Contains("/api/Board/Get/{id}", routes);
            Assert.Contains("/api/Counter/Get/{id}", routes);
            Assert.Contains("/api/Counter/GetByName/{name}", routes);
            Assert.Contains("/api/Eventbrite/SetTicketCapacity/{id:guid}", routes);
            Assert.Contains("/api/PublicQuestionnaire/{id:guid}/responses", routes);
            Assert.Contains("/api/Questionnaire/{id:guid}/export", routes);
            Assert.Contains("/api/Speaker/ReconcileDuplicates", routes);
            Assert.Contains("/api/TopMenu/{id}", routes);
            Assert.Contains("/api/Values/ValuesMfa", routes);
            Assert.Contains("/api/Venue/{id}", routes);
            Assert.Contains("/api/Workshop/GetInHomePage/HomePage", routes);
            Assert.Contains("/api/Workshop/ImportSessionize/{id}", routes);
            Assert.Contains("/api/WorkshopFile/UploadWorkshopImage", routes);
        }

        private static WebApplication CreateApp()
        {
            var builder = WebApplication.CreateSlimBuilder();
            builder.Services.AddAuthorization();
            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment);
            builder.Services.AddRateLimiter(_ => { });
            builder.Services.AddSingleton<DatabaseBackupService>();
            builder.Services.AddSingleton<BoardService>();
            builder.Services.AddSingleton<CounterService>();
            builder.Services.AddSingleton<EventbriteIntegrationService>();
            builder.Services.AddSingleton<EventbriteApiClient>();
            builder.Services.AddSingleton<QuestionnaireService>();
            builder.Services.AddSingleton<SpeakerService>();
            builder.Services.AddSingleton<TopMenuService>();
            builder.Services.AddSingleton<VenueService>();
            builder.Services.AddSingleton<WorkshopService>();
            builder.Services.AddSingleton<WorkshopFileService>();
            builder.Services.AddSingleton<WorkshopAssetStorage>();
            builder.Services.AddSingleton<SessionizeImportService>();
            builder.Services.AddSingleton<LegacySpeakerReferenceRepairService>();
            var app = builder.Build();
            app.MapApiEndpoints();
            return app;
        }

        private static string Route(RouteEndpoint endpoint) => endpoint.RoutePattern.RawText!;
}
