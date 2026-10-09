using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class OtpRequirementTests
{
    [Theory]
    [InlineData("mfa", "mfa", true)]
    [InlineData("hwk", "hwk", true)]
    [InlineData("mfa", "hwk", false)]
    [InlineData("hwk", "mfa", false)]
    [InlineData("mfa", "MFA", false)]
    [InlineData("mfa", null, false)]
    public async Task ExactClaimIsRequiredAndChallengeModeIsPreserved(string mode, string? claim, bool authorized)
    {
        var httpContext = new DefaultHttpContext();
        var requirement = new OtpRequirement(mode);
        var claims = claim is null ? Array.Empty<Claim>() : [new Claim("acr", claim)];
        var user = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
        var context = new AuthorizationHandlerContext([requirement], user, null);
        var handler = new OtpRequirementHandler(NullLogger<OtpRequirementHandler>.Instance,
            new HttpContextAccessor { HttpContext = httpContext });

        await handler.HandleAsync(context);

        Assert.Equal(authorized, context.HasSucceeded);
        Assert.Equal(mode, httpContext.Items["acr"]);
        Assert.False(context.HasFailed);
    }

    [Fact]
    public async Task MissingHttpContextDoesNotAuthorizeOrThrow()
    {
        var requirement = new OtpRequirement("mfa");
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim("acr", "mfa")], "test"));
        var context = new AuthorizationHandlerContext([requirement], user, null);
        var handler = new OtpRequirementHandler(NullLogger<OtpRequirementHandler>.Instance, new HttpContextAccessor());

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }
}