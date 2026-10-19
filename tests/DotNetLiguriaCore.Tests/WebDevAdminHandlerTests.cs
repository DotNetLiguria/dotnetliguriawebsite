using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class WebDevAdminHandlerTests
{
    [Fact]
    public void WebDevAdminRoleDoesNotGrantQuestionnaireAdministration()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("realm_access", """{"roles":["dnl-webdevadmin"]}""")],
            "Bearer"));

        Assert.True(WebDevAdminHandler.IsWebDevAdmin(user, new WebDevAdminAuthorizationOptions()));
        Assert.False(FeedbackAdminHandler.IsFeedbackAdmin(user, new QuestionnaireAuthorizationOptions()));
    }

    [Fact]
    public void FeedbackAdminRoleDoesNotGrantWebsiteAdministration()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("realm_access", """{"roles":["feedbackadmin"]}""")],
            "Bearer"));

        Assert.True(FeedbackAdminHandler.IsFeedbackAdmin(user, new QuestionnaireAuthorizationOptions()));
        Assert.False(WebDevAdminHandler.IsWebDevAdmin(user, new WebDevAdminAuthorizationOptions()));
    }
}
