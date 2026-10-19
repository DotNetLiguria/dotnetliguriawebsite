using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Security;

public sealed class KeycloakActiveAccountVerifier(HttpClient httpClient, IOptions<PrivacyOptions> options)
{
    private readonly HttpClient _httpClient = httpClient;
    private readonly PrivacyOptions _options = options.Value;

    public async Task<bool> IsActiveAsync(AccountReference account, string accessToken, CancellationToken cancellationToken)
    {
        var issuer = KeycloakIdentityAccountAdmin.ValidateIssuer(_options);
        if (account.Issuer != issuer.AbsoluteUri || string.IsNullOrWhiteSpace(accessToken))
            return false;

        // Keycloak UserInfo checks the live user and session, without service-account privileges.
        using var request = new HttpRequestMessage(HttpMethod.Get,
            issuer.AbsoluteUri + "/protocol/openid-connect/userinfo");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            return false;
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentType?.MediaType != "application/json")
            throw new JsonException("Unexpected identity verification response.");
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement.ValueKind == JsonValueKind.Object &&
            document.RootElement.TryGetProperty("sub", out var subject) &&
            subject.ValueKind == JsonValueKind.String && subject.GetString() == account.Subject;
    }
}
