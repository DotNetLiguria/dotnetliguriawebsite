using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests.Questionnaires;

public class FeedbackAdminHandlerTests
{
    [Theory]
    [InlineData("realm_access", """{"roles":["offline_access","feedbackadmin"]}""", true)]
    [InlineData("resource_access", """{"DotNetLiguriaCore":{"roles":["FeedbackAdmin"]}}""", true)]
    [InlineData("realm_access", """{"roles":["user"]}""", false)]
    [InlineData("roles", "feedbackadmin", true)]
    [InlineData("roles", """["feedbackadmin"]""", true)]
    [InlineData(ClaimTypes.Role, "feedbackadmin", true)]
    [InlineData("feedbackadmin", "true", true)]
    [InlineData("feedbackadmin", "false", false)]
    [InlineData("realm_access", "not json", false)]
    [InlineData("name", "feedbackadmin", false)]
    public async Task RoleOrClaimGrantsAccess(string type, string value, bool expected)
    {
        Assert.Equal(expected, await AuthorizeAsync(new ClaimsIdentity([new Claim(type, value)], "Bearer")));
    }

    [Fact]
    public async Task AnonymousUserIsRejectedEvenWithClaim()
    {
        Assert.False(await AuthorizeAsync(new ClaimsIdentity([new Claim("feedbackadmin", "true")])));
    }

    [Fact]
    public void RoleAndClaimNamesAreConfigurable()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("roles", "survey-editor")], "Bearer"));

        Assert.True(FeedbackAdminHandler.IsFeedbackAdmin(user, new QuestionnaireAuthorizationOptions { AdminRole = "survey-editor" }));
        Assert.False(FeedbackAdminHandler.IsFeedbackAdmin(user, new QuestionnaireAuthorizationOptions()));
    }

    private static async Task<bool> AuthorizeAsync(ClaimsIdentity identity)
    {
        var requirement = new FeedbackAdminRequirement();
        var context = new AuthorizationHandlerContext([requirement], new ClaimsPrincipal(identity), null);
        var handler = new FeedbackAdminHandler(Options.Create(new QuestionnaireAuthorizationOptions()));
        await handler.HandleAsync(context);
        return context.HasSucceeded;
    }
}
