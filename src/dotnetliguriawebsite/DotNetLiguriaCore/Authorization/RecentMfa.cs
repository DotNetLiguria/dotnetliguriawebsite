using System.Globalization;
using System.Security.Claims;

namespace DotNetLiguriaCore.Authorization;

public static class RecentMfa
{
    public static bool IsSatisfied(ClaimsPrincipal principal, TimeProvider timeProvider)
    {
        if (principal.Identity?.IsAuthenticated != true ||
            !principal.Claims.Any(claim => claim.Type == "acr" && claim.Value is "mfa" or "hwk"))
            return false;

        var times = principal.FindAll("auth_time").ToArray();
        if (times.Length != 1 ||
            !long.TryParse(times[0].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
            return false;

        var now = timeProvider.GetUtcNow().ToUnixTimeSeconds();
        return seconds <= now && seconds >= now - 300;
    }
}
