using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Tests.Questionnaires;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class RecentMfaTests
{
    [Theory]
    [InlineData("mfa", "1746100800", true)]
    [InlineData("hwk", "1746100500", true)]
    [InlineData("mfa", "1746100499", false)]
    [InlineData("pwd", "1746100800", false)]
    [InlineData("mfa", "1746100801", false)]
    [InlineData("mfa", "not-a-time", false)]
    public void RequiresFreshIssuerAssurance(string acr, string authTime, bool expected)
    {
        var clock = new FixedTimeProvider(DateTimeOffset.FromUnixTimeSeconds(1746100800));
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("acr", acr), new Claim("auth_time", authTime)], "Bearer"));
        Assert.Equal(expected, RecentMfa.IsSatisfied(user, clock));
    }

    [Fact]
    public void DuplicatedAuthenticationTimeIsRejected()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("acr", "mfa"), new Claim("auth_time", "1"), new Claim("auth_time", "2")], "Bearer"));
        Assert.False(RecentMfa.IsSatisfied(user, TimeProvider.System));
    }
}
