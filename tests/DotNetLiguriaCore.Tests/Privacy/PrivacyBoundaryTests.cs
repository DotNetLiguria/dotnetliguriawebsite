using System.Security.Claims;
using DotNetLiguriaCore.Services.Privacy;
using Xunit;

namespace DotNetLiguriaCore.Tests.Privacy;

public sealed class PrivacyBoundaryTests
{
    [Theory]
    [InlineData("http://hello.vevy.com/realms/test")]
    [InlineData("https://hello.vevy.com.attacker.example/realms/test")]
    [InlineData("https://hello.vevy.com@attacker.example/realms/test")]
    [InlineData("https://hello.vevy.com/realms/test/../master")]
    [InlineData("https://hello.vevy.com:444/realms/test")]
    [InlineData("https://hello.vevy.com/realms/test?redirect=x")]
    [InlineData("https://127.0.0.1/realms/test")]
    public void IdentityAdminRejectsUnapprovedEndpoints(string issuer)
    {
        Assert.Throws<PrivacyBlockedException>(() =>
            KeycloakIdentityAccountAdmin.ValidateIssuer(new PrivacyOptions { Issuer = issuer }));
    }

    [Fact]
    public void ExactConfiguredIssuerIsAccepted()
    {
        Assert.Equal("https://hello.vevy.com/realms/test",
            KeycloakIdentityAccountAdmin.ValidateIssuer(new PrivacyOptions { Issuer = "https://hello.vevy.com/realms/test" }).AbsoluteUri);
    }

    [Fact]
    public void ProfileClaimsNeverSelectAccountAndDuplicateSubjectsAreRejected()
    {
        var issuer = "https://hello.vevy.com/realms/test";
        var user = new ClaimsPrincipal(new ClaimsIdentity(
            [new("iss", issuer), new("sub", "subject"), new(ClaimTypes.Email, "synthetic@example.test")], "Bearer"));
        Assert.Equal(new AccountReference(issuer, "subject"), AccountReference.FromPrincipal(user, issuer));
        ((ClaimsIdentity)user.Identity!).AddClaim(new Claim("sub", "other"));
        Assert.Throws<PrivacyBlockedException>(() => AccountReference.FromPrincipal(user, issuer));
    }

    [Fact]
    public void BackupRootsCannotBeStaticOrContainApplicationRoot()
    {
        var root = Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "privacy-path-fixture"));
        Assert.Throws<PrivacyBlockedException>(() => PrivacyStoragePaths.ValidateBackupRoot(Path.Combine(root, "wwwroot", "Backups"), root));
        Assert.Throws<PrivacyBlockedException>(() => PrivacyStoragePaths.ValidateBackupRoot(Path.Combine(root, "Contents"), root));
        Assert.Throws<PrivacyBlockedException>(() => PrivacyStoragePaths.ValidateBackupRoot(root, root));
        Assert.Equal(Path.Combine(root, "Backups"), PrivacyStoragePaths.ValidateBackupRoot("Backups", root));
    }

    [Fact]
    public async Task GateSerializesWorkWithoutWallClockWaits()
    {
        var gate = new PrivacyOperationGate();
        using var first = await gate.EnterAsync(TestContext.Current.CancellationToken);
        var second = gate.EnterAsync(TestContext.Current.CancellationToken).AsTask();
        Assert.False(second.IsCompleted);
        first.Dispose();
        using var acquired = await second;
        acquired.Dispose();
        using var third = await gate.EnterAsync(TestContext.Current.CancellationToken);
    }
}
