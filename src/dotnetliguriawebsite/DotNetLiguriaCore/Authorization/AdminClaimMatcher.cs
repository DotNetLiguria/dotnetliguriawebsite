using System.Security.Claims;
using System.Text.Json;

namespace DotNetLiguriaCore.Authorization;

public static class AdminClaimMatcher
{
    public static bool IsAuthorized(ClaimsPrincipal user, string? role, string? claim, string clientId = "DotNetLiguriaCore")
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(claim) && user.Claims.Any(c =>
                string.Equals(c.Type, claim, StringComparison.Ordinal) &&
                bool.TryParse(c.Value, out var granted) && granted))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        foreach (var userClaim in user.Claims)
        {
            if ((userClaim.Type == "realm_access" || userClaim.Type == "resource_access") &&
                StructuredRoleMatches(userClaim.Value, role, userClaim.Type == "resource_access" ? clientId : null))
            {
                return true;
            }
        }

        return false;
    }

    private static bool StructuredRoleMatches(string json, string role, string? clientId)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var element = document.RootElement;
            if (element.ValueKind != JsonValueKind.Object)
                return false;
            if (clientId is not null &&
                (!element.TryGetProperty(clientId, out element) || element.ValueKind != JsonValueKind.Object))
                return false;
            return element.TryGetProperty("roles", out var roles) &&
                roles.ValueKind == JsonValueKind.Array &&
                roles.EnumerateArray().Any(value => value.ValueKind == JsonValueKind.String &&
                    string.Equals(value.GetString(), role, StringComparison.Ordinal));
        }
        catch (JsonException)
        {
            return false;
        }
    }

}
