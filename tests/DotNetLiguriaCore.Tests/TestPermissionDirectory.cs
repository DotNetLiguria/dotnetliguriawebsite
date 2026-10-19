using System.Security.Claims;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests;

public sealed class TestPermissionDirectory(params string[] permissions) : IPermissionDirectory
{
    public const string Issuer = "https://identity.example.test/realms/synthetic";
    public HashSet<string> Permissions { get; } = new(permissions, StringComparer.Ordinal);
    public int Reads { get; private set; }
    public PrivacyBlockedException? Failure { get; set; }

    public Task<IReadOnlySet<string>> GetEffectiveAsync(AccountReference account, CancellationToken cancellationToken)
    {
        Reads++;
        if (Failure is not null) throw Failure;
        return Task.FromResult<IReadOnlySet<string>>(Permissions);
    }

    public static ClaimsPrincipal Principal(params Claim[] claims) => new(new ClaimsIdentity(
        new[] { new Claim("iss", Issuer), new Claim("sub", "synthetic-subject") }.Concat(claims), "Bearer"));
}
