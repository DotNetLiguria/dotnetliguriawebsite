using System.Reflection;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WriteEndpointAuthorizationTests
{
    [Fact]
    public void WriteActionsRequireTheirRoleSpecificAdminPolicy()
    {
        var controllerTypes = new[]
        {
            typeof(BoardController),
            typeof(SpeakerController),
            typeof(VenueController),
            typeof(TopMenuController),
            typeof(WorkshopFileController),
            typeof(CounterController),
            typeof(ValuesController),
            typeof(WorkshopController),
            typeof(EventbriteController),
            typeof(QuestionnaireController)
        };

        var writeActions = controllerTypes
            .SelectMany(controllerType => controllerType
                .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(method => method.GetCustomAttributes<HttpMethodAttribute>()
                    .Any(attribute => attribute.HttpMethods.Any(httpMethod =>
                        httpMethod is "POST" or "PUT" or "PATCH" or "DELETE")))
                .Select(method => (ControllerType: controllerType, Method: method)));

        Assert.NotEmpty(writeActions);
        Assert.All(writeActions, action =>
        {
            var authorization = action.Method.GetCustomAttribute<AuthorizeAttribute>()
                ?? action.ControllerType.GetCustomAttribute<AuthorizeAttribute>();

            Assert.NotNull(authorization);
            var expectedPolicy = action.ControllerType == typeof(QuestionnaireController)
                ? QuestionnaireAuthorizationOptions.PolicyName
                : WebDevAdminAuthorizationOptions.PolicyName;
            Assert.Equal(expectedPolicy, authorization.Policy);
        });
    }
}
