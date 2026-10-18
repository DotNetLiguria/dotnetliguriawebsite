using System.Security.Claims;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed record AccountReference(string Issuer, string Subject)
{
    public string ActorKey => Issuer + "|" + Subject;

    public static AccountReference FromPrincipal(ClaimsPrincipal user, string expectedIssuer)
    {
        if (string.IsNullOrWhiteSpace(expectedIssuer))
            throw new PrivacyBlockedException("identity_admin_not_configured");
        var issuers = user.FindAll("iss").ToArray();
        var subjects = user.FindAll("sub").ToArray();
        if (user.Identity?.IsAuthenticated != true || issuers.Length != 1 || subjects.Length != 1 ||
            issuers[0].Value != expectedIssuer || string.IsNullOrWhiteSpace(subjects[0].Value) ||
            subjects[0].Value.Length > 200 || subjects[0].Value.Contains('|') ||
            subjects[0].Value.Any(char.IsControl))
            throw new PrivacyBlockedException("invalid_account_reference", StatusCodes.Status403Forbidden);
        return new AccountReference(issuers[0].Value, subjects[0].Value);
    }
}
