using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Authorization;

// Accepts the configured Keycloak role (realm or client role, flattened or as JSON claims)
// or a dedicated claim whose value is not "false"/"0".
public class FeedbackAdminHandler(IOptions<QuestionnaireAuthorizationOptions> options)
    : AuthorizationHandler<FeedbackAdminRequirement>
{
    private static readonly string[] _flatRoleClaims = ["roles", "role", ClaimTypes.Role, "roles0", "roles1", "roles2"];

    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, FeedbackAdminRequirement requirement)
    {
        if (IsFeedbackAdmin(context.User, options.Value))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }

    public static bool IsFeedbackAdmin(ClaimsPrincipal user, QuestionnaireAuthorizationOptions options)
    {
        if (user.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        var role = options.AdminRole;
        if (!string.IsNullOrWhiteSpace(options.AdminClaim) && user.Claims.Any(c =>
                string.Equals(c.Type, options.AdminClaim, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(c.Value, "false", StringComparison.OrdinalIgnoreCase) && c.Value != "0"))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(role))
        {
            return false;
        }

        foreach (var claim in user.Claims)
        {
            if (_flatRoleClaims.Contains(claim.Type) && RoleValueMatches(claim.Value, role))
            {
                return true;
            }

            if ((claim.Type == "realm_access" || claim.Type == "resource_access") && JsonContainsRole(claim.Value, role))
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

    // Walks {"roles":[...]} and {"client":{"roles":[...]}} shapes.
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
