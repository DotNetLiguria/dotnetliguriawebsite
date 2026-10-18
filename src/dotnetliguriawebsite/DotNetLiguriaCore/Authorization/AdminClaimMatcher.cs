using System.Security.Claims;
using System.Text.Json;

namespace DotNetLiguriaCore.Authorization;

public static class AdminClaimMatcher
{
    private static readonly string[] _flatRoleClaims = ["roles", "role", ClaimTypes.Role, "roles0", "roles1", "roles2"];

    public static bool IsAuthorized(ClaimsPrincipal user, string? role, string? claim, string clientId = "DotNetLiguriaCore")
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(claim) && user.Claims.Any(c =>
                string.Equals(c.Type, claim, StringComparison.Ordinal) &&
                string.Equals(c.Value, "true", StringComparison.Ordinal)))
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
                StructuredRoleMatches(userClaim.Value, role, userClaim.Type == "resource_access" ? clientId : null))
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

        return string.Equals(value, role, StringComparison.Ordinal);
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

    private static bool JsonContainsRole(string json, string role)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.ValueKind == JsonValueKind.Array &&
                document.RootElement.EnumerateArray().Any(value => value.ValueKind == JsonValueKind.String &&
                    string.Equals(value.GetString(), role, StringComparison.Ordinal));
        }
        catch (JsonException)
        {
            return false;
        }
    }

}
