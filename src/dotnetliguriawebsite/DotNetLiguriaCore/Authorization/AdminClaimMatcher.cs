using System.Security.Claims;
using System.Text.Json;

namespace DotNetLiguriaCore.Authorization;

public static class AdminClaimMatcher
{
    private static readonly string[] _flatRoleClaims = ["roles", "role", ClaimTypes.Role, "roles0", "roles1", "roles2"];

    public static bool IsAuthorized(ClaimsPrincipal user, string? role, string? claim)
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(claim) && user.Claims.Any(c =>
                string.Equals(c.Type, claim, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(c.Value, "false", StringComparison.OrdinalIgnoreCase) && c.Value != "0"))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        foreach (var userClaim in user.Claims)
        {
            if (_flatRoleClaims.Contains(userClaim.Type) && RoleValueMatches(userClaim.Value, role))
            {
                return true;
            }

            if ((userClaim.Type == "realm_access" || userClaim.Type == "resource_access") &&
                JsonContainsRole(userClaim.Value, role))
            {
                return true;
            }
        }

        return false;
    }

    private static bool RoleValueMatches(string value, string role)
    {
        var trimmed = value.TrimStart();
        if (trimmed.StartsWith('[') || trimmed.StartsWith('{'))
        {
            return JsonContainsRole(value, role);
        }

        return string.Equals(value, role, StringComparison.OrdinalIgnoreCase);
    }

    private static bool JsonContainsRole(string json, string role)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return ElementContainsRole(document.RootElement, role, 0);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool ElementContainsRole(JsonElement element, string role, int depth)
    {
        if (depth > 4)
        {
            return false;
        }

        return element.ValueKind switch
        {
            JsonValueKind.String => string.Equals(element.GetString(), role, StringComparison.OrdinalIgnoreCase),
            JsonValueKind.Array => element.EnumerateArray().Any(e => ElementContainsRole(e, role, depth + 1)),
            JsonValueKind.Object => element.EnumerateObject().Any(p => p.Value.ValueKind != JsonValueKind.String &&
                ElementContainsRole(p.Value, role, depth + 1)),
            _ => false,
        };
    }
}
