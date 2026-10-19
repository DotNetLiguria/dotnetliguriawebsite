using System.Text.Json;
using System.Text.RegularExpressions;
using DotNetLiguriaCore.Authorization;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public sealed class PermissionConfigurationTests
{
    [Fact]
    public void FrontendPermissionIdsMatchTheServerCatalogueExactly()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        var source = File.ReadAllText(Path.Combine(directory.FullName, "src", "dotnetliguriaspa",
            "src", "account", "permissions.ts"));
        var permissions = Regex.Matches(source, @"[""'](?<permission>[a-z][a-z-]*\.[a-z][a-z.-]*)[""']")
            .Select(match => match.Groups["permission"].Value).Distinct(StringComparer.Ordinal).Order();
        Assert.Equal(PermissionCatalog.Ids.Order(), permissions);
    }

    [Fact]
    public void DevelopmentRealmDisablesFullScopeAndExplicitlyMapsTheExactCatalogue()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "DotNetLiguria.slnx")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        using var json = JsonDocument.Parse(File.ReadAllText(Path.Combine(directory.FullName, "keycloak", "dev", "realm-dotnetliguria.json")));
        var realm = json.RootElement;
        Assert.All(realm.GetProperty("clients").EnumerateArray(), client =>
            Assert.False(client.GetProperty("fullScopeAllowed").GetBoolean()));
        var roles = realm.GetProperty("roles").GetProperty("client").GetProperty("DotNetLiguriaCore")
            .EnumerateArray().Select(role => role.GetProperty("name").GetString()).Order().ToArray();
        Assert.Equal(PermissionCatalog.Ids.Order(), roles);
        var prospect = File.ReadAllText(Path.Combine(directory.FullName, "docs", "authorization.md"));
        Assert.All(PermissionCatalog.Ids, permission =>
            Assert.Contains("| `" + permission + "` |", prospect));
        var scope = Assert.Single(realm.GetProperty("clientScopeMappings").GetProperty("DotNetLiguriaCore").EnumerateArray());
        Assert.Equal("dotnetliguria-permissions", scope.GetProperty("clientScope").GetString());
        Assert.Equal(PermissionCatalog.Ids.Order(), scope.GetProperty("roles").EnumerateArray().Select(value => value.GetString()).Order());
        var applicationScope = Assert.Single(realm.GetProperty("clientScopes").EnumerateArray(),
            item => item.GetProperty("name").GetString() == "dotnetliguria-permissions");
        var mapper = Assert.Single(applicationScope.GetProperty("protocolMappers").EnumerateArray(),
            item => item.GetProperty("protocolMapper").GetString() == "oidc-usermodel-client-role-mapper");
        var config = mapper.GetProperty("config");
        Assert.Equal("DotNetLiguriaCore", config.GetProperty("usermodel.clientRoleMapping.clientId").GetString());
        Assert.Equal("permissions", config.GetProperty("claim.name").GetString());
        Assert.Equal("true", config.GetProperty("multivalued").GetString());
        Assert.Equal("true", config.GetProperty("access.token.claim").GetString());
        var spa = Assert.Single(realm.GetProperty("clients").EnumerateArray(),
            client => client.GetProperty("clientId").GetString() == "DotNetLiguriaSpa");
        Assert.Contains(spa.GetProperty("defaultClientScopes").EnumerateArray(),
            item => item.GetString() == "dotnetliguria-permissions");
    }
}
