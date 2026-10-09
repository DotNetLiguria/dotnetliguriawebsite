using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using CommonAuth;
using Xunit;

namespace DotNetLiguriaCore.Tests;

public class TokenHelpersTests
{
    [Fact]
    public void SyntheticTokenRetainsClaimsAndReadablePayload()
    {
        var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(
            issuer: "https://issuer.example.test", audience: "test-client",
            claims: [new Claim("sub", "test-user"), new Claim("acr", "mfa")]));

        var (header, payload) = TokenHelpers.GetTokenJson(token);
        using var headerJson = JsonDocument.Parse(header);
        using var payloadJson = JsonDocument.Parse(payload);

        Assert.Equal("none", headerJson.RootElement.GetProperty("alg").GetString());
        Assert.Equal("test-user", payloadJson.RootElement.GetProperty("sub").GetString());
        Assert.Equal("mfa", payloadJson.RootElement.GetProperty("acr").GetString());
        Assert.Contains("acr: mfa", TokenHelpers.GetTokenText(token));
        Assert.Contains("\n", payload);
    }

    [Fact]
    public void NullJsonTokenHasTheHistoricalEmptyResult()
    {
        Assert.Equal((string.Empty, string.Empty), TokenHelpers.GetTokenJson(null!));
    }

    [Fact]
    public void MalformedTokenIsRejected()
    {
        Assert.ThrowsAny<ArgumentException>(() => TokenHelpers.GetTokenJson("not-a-jwt"));
    }
}