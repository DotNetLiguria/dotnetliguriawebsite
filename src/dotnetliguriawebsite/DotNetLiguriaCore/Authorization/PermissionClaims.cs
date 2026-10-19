using System.Collections.Frozen;
using System.Security.Claims;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace DotNetLiguriaCore.Authorization;

public static class PermissionClaims
{
    public static void ValidateToken(JsonWebToken token)
    {
        using var payload = JsonDocument.Parse(Base64UrlEncoder.DecodeBytes(token.EncodedPayload));
        if (!payload.RootElement.TryGetProperty("permissions", out var permissions)) return;
        if (permissions.ValueKind != JsonValueKind.Array ||
            permissions.EnumerateArray().Any(value => value.ValueKind != JsonValueKind.String))
            throw new PrivacyBlockedException("invalid_permission_claim", 403);
    }

    public static IReadOnlySet<string> Read(ClaimsPrincipal principal)
    {
        if (principal.Identities.Count() != 1 || principal.Identity?.IsAuthenticated != true)
            return FrozenSet<string>.Empty;
        var permissions = new HashSet<string>(StringComparer.Ordinal);
        foreach (var claim in principal.FindAll("permissions"))
        {
            if (claim.ValueType == ClaimValueTypes.Boolean || claim.ValueType == ClaimValueTypes.Integer ||
                claim.ValueType == ClaimValueTypes.Integer64)
                throw new PrivacyBlockedException("invalid_permission_claim", 403);
            if (claim.Value.StartsWith('['))
            {
                try
                {
                    using var document = JsonDocument.Parse(claim.Value);
                    if (document.RootElement.ValueKind != JsonValueKind.Array ||
                        document.RootElement.EnumerateArray().Any(value => value.ValueKind != JsonValueKind.String))
                        throw new PrivacyBlockedException("invalid_permission_claim", 403);
                    foreach (var value in document.RootElement.EnumerateArray())
                        if (PermissionCatalog.IsKnown(value.GetString()!)) permissions.Add(value.GetString()!);
                }
                catch (JsonException)
                {
                    throw new PrivacyBlockedException("invalid_permission_claim", 403);
                }
            }
            else if (PermissionCatalog.IsKnown(claim.Value)) permissions.Add(claim.Value);
            else if (claim.ValueType != ClaimValueTypes.String)
                throw new PrivacyBlockedException("invalid_permission_claim", 403);
        }
        return permissions.ToFrozenSet(StringComparer.Ordinal);
    }
}
