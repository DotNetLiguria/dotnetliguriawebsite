using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PermissionEvaluatorTests
{
    public static TheoryData<string> Catalogue => new(PermissionCatalog.Ids);

    [Theory]
    [MemberData(nameof(Catalogue))]
    public async Task EveryPermissionRequiresBothTokenScopeAndLiveAssignment(string permission)
    {
        var directory = new TestPermissionDirectory(permission);
        var evaluator = Create(directory);
        Assert.Contains(permission, await evaluator.GetAsync(TestPermissionDirectory.Principal(new Claim("permissions", permission)), TestContext.Current.CancellationToken));
        Assert.Empty(await evaluator.GetAsync(TestPermissionDirectory.Principal(), TestContext.Current.CancellationToken));
        directory.Permissions.Clear();
        Assert.Empty(await Create(directory).GetAsync(TestPermissionDirectory.Principal(new Claim("permissions", permission)), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task LiveChecksAreDeduplicatedOnlyWithinTheRequest()
    {
        var directory = new TestPermissionDirectory("events.manage");
        var principal = TestPermissionDirectory.Principal(new Claim("permissions", "events.manage"));
        var firstRequest = Create(directory);
        Assert.Contains("events.manage", await firstRequest.GetAsync(principal, TestContext.Current.CancellationToken));
        await firstRequest.GetAsync(principal, TestContext.Current.CancellationToken);
        Assert.Equal(1, directory.Reads);
        directory.Permissions.Clear();
        Assert.Empty(await Create(directory).GetAsync(principal, TestContext.Current.CancellationToken));
        Assert.Equal(2, directory.Reads);
    }

    [Fact]
    public void RealJwtArrayAndJsonArrayProduceTheSameExactPermissions()
    {
        var handler = new JsonWebTokenHandler();
        var jwt = handler.ReadJsonWebToken(handler.CreateToken(new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object> { ["permissions"] = new[] { "events.read", "Events.Read", "foreign.permission" } },
        }));
        PermissionClaims.ValidateToken(jwt);
        Assert.Equal(["events.read"], PermissionClaims.Read(TestPermissionDirectory.Principal(jwt.Claims.ToArray())));
        Assert.Equal(["events.read"], PermissionClaims.Read(TestPermissionDirectory.Principal(
            new Claim("permissions", JsonSerializer.Serialize(new[] { "events.read", "Events.Read" })))));
    }

    [Theory]
    [InlineData("\"events.read\"")]
    [InlineData("true")]
    [InlineData("{\"events.read\":true}")]
    [InlineData("[\"events.read\",true]")]
    public void ActualJwtRequiresAnArrayOfStrings(string rawPermissions)
    {
        var token = new JsonWebToken(new JsonWebTokenHandler().CreateToken(
            "{\"permissions\":" + rawPermissions + "}"));
        Assert.Throws<PrivacyBlockedException>(() => PermissionClaims.ValidateToken(token));
    }

    [Theory]
    [InlineData("[true]")]
    [InlineData("[\"events.read\",2]")]
    [InlineData("[")]
    public void MalformedArraysAreNotPrivileges(string value) =>
        Assert.Throws<PrivacyBlockedException>(() => PermissionClaims.Read(
            TestPermissionDirectory.Principal(new Claim("permissions", value))));

    [Fact]
    public void AnonymousAndMixedIdentitiesCannotCombinePrivileges()
    {
        Assert.Empty(PermissionClaims.Read(new ClaimsPrincipal(new ClaimsIdentity([new Claim("permissions", "events.read")]))));
        var mixed = TestPermissionDirectory.Principal(new Claim("permissions", "events.read"));
        mixed.AddIdentity(new ClaimsIdentity([new Claim("permissions", "backups.restore")], "other"));
        Assert.Empty(PermissionClaims.Read(mixed));
    }

    private static PermissionEvaluator Create(TestPermissionDirectory directory) => new(directory,
        Options.Create(new PrivacyOptions { Issuer = TestPermissionDirectory.Issuer }));
}
