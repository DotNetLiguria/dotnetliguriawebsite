using System.Security.Claims;

namespace DotNetLiguriaCore.Security;

public sealed record AccountIdentity(string Issuer, string Subject)
{
    public static AccountIdentity? FromPrincipal(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
            return null;
        var issuers = principal.FindAll("iss").ToArray();
        var subjects = principal.FindAll("sub").ToArray();
        return issuers.Length == 1 && subjects.Length == 1 &&
            !string.IsNullOrWhiteSpace(issuers[0].Value) &&
            !string.IsNullOrWhiteSpace(subjects[0].Value)
            ? new AccountIdentity(issuers[0].Value, subjects[0].Value)
            : null;
    }
}
