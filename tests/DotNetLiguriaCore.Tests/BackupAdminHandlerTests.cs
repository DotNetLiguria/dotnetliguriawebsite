using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class BackupAdminHandlerTests
{
    [Theory]
    [InlineData("realm_access", """{"roles":["backupadmin"]}""", true)]
    [InlineData("resource_access", """{"DotNetLiguriaCore":{"roles":["backupadmin"]}}""", true)]
    [InlineData("resource_access", """{"unrelated-client":{"roles":["backupadmin"]}}""", false)]
    [InlineData("roles", "backupadmin", false)]
    [InlineData("backupadmin", "true", true)]
    [InlineData("backupadmin", "false", false)]
    [InlineData("roles", "feedbackadmin", false)]
    [InlineData("name", "backupadmin", false)]
    public async Task DedicatedRoleOrClaimControlsBackupAccess(string claimType, string value, bool expected)
    {
        var identity = new ClaimsIdentity([new Claim(claimType, value)], "Bearer");
        var requirement = new BackupAdminRequirement();
        var context = new AuthorizationHandlerContext([requirement], new ClaimsPrincipal(identity), null);
        var handler = new BackupAdminHandler(Options.Create(new BackupAuthorizationOptions()));

        await handler.HandleAsync(context);

        Assert.Equal(expected, context.HasSucceeded);
    }

    [Fact]
    public async Task AnonymousUserIsRejectedEvenWithBackupClaim()
    {
        var identity = new ClaimsIdentity([new Claim("backupadmin", "true")]);
        var requirement = new BackupAdminRequirement();
        var context = new AuthorizationHandlerContext([requirement], new ClaimsPrincipal(identity), null);
        var handler = new BackupAdminHandler(Options.Create(new BackupAuthorizationOptions()));

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }
}
