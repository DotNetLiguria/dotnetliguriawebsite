using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class KeycloakIdentityAccountAdmin(HttpClient httpClient, IOptions<PrivacyOptions> options) : IIdentityAccountAdmin
{
    private readonly HttpClient _httpClient = httpClient;
    private readonly PrivacyOptions _options = options.Value;
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

    public static Uri ValidateIssuer(PrivacyOptions options)
    {
        if (!Uri.TryCreate(options.Issuer, UriKind.Absolute, out var issuer) ||
            issuer.Scheme != Uri.UriSchemeHttps || issuer.Port != 443 || issuer.UserInfo.Length != 0 ||
            issuer.Query.Length != 0 || issuer.Fragment.Length != 0 || issuer.AbsoluteUri != options.Issuer ||
            !string.Equals(issuer.IdnHost, options.AllowedIdentityHost, StringComparison.OrdinalIgnoreCase) ||
            Uri.CheckHostName(issuer.IdnHost) != UriHostNameType.Dns)
            throw new PrivacyBlockedException("identity_admin_not_configured");
        var parts = issuer.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || parts[0] != "realms" || parts[1].Length > 100 ||
            parts[1].Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_') ||
            issuer.AbsolutePath != "/realms/" + parts[1])
            throw new PrivacyBlockedException("identity_admin_not_configured");
        return issuer;
    }

    public async Task<IdentityAccount?> GetAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Get, UserPath(account), null, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        EnsureSuccess(response);
        var profile = await response.Content.ReadFromJsonAsync<IdentityAccount>(_jsonOptions, cancellationToken);
        if (profile is null || profile.Id != account.Subject)
            throw new PrivacyBlockedException("identity_admin_invalid_response");
        profile.Attributes ??= new(StringComparer.Ordinal);
        return profile;
    }

    public async Task DisableAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Put, UserPath(account), new { enabled = false }, cancellationToken);
        if (response.StatusCode != HttpStatusCode.NotFound) EnsureSuccess(response);
        using var logout = await SendAsync(HttpMethod.Post, UserPath(account) + "/logout", null, cancellationToken);
        if (logout.StatusCode != HttpStatusCode.NotFound) EnsureSuccess(logout);
    }

    public async Task DeleteAsync(AccountReference account, CancellationToken cancellationToken)
    {
        using var response = await SendAsync(HttpMethod.Delete, UserPath(account), null, cancellationToken);
        if (response.StatusCode != HttpStatusCode.NotFound) EnsureSuccess(response);
    }

    public async Task SetConsentAsync(AccountReference account, string purpose, string? evidence, CancellationToken cancellationToken)
    {
        if (!_options.IdentityAttributePermissionsApproved)
            throw new PrivacyBlockedException("consent_attribute_permissions_not_approved");
        var attribute = Notifications.NotificationConsent.AttributeFor(purpose);
        var profile = await GetAsync(account, cancellationToken)
            ?? throw new PrivacyBlockedException("account_unavailable", StatusCodes.Status409Conflict);
        // Keycloak replaces attributes on PUT. Preserve unrelated attributes; never write roles or privileges.
        if (evidence is null) profile.Attributes.Remove(attribute);
        else profile.Attributes[attribute] = [evidence];
        using var response = await SendAsync(HttpMethod.Put, UserPath(account), new { attributes = profile.Attributes }, cancellationToken);
        EnsureSuccess(response);
        var stored = await GetAsync(account, cancellationToken)
            ?? throw new PrivacyBlockedException("account_unavailable", StatusCodes.Status409Conflict);
        var persisted = stored.Attributes.GetValueOrDefault(attribute);
        if (evidence is null ? persisted is { Length: > 0 } : persisted is not { Length: 1 } || persisted[0] != evidence)
            throw new PrivacyBlockedException("consent_write_not_verified");
    }

    public async IAsyncEnumerable<IdentityAccount> ListAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var issuer = ValidateIssuer(_options);
        for (var first = 0; first < 10000; first += 100)
        {
            using var response = await SendAsync(HttpMethod.Get,
                $"/admin{issuer.AbsolutePath}/users?first={first}&max=100&briefRepresentation=false", null, cancellationToken);
            EnsureSuccess(response);
            var accounts = await response.Content.ReadFromJsonAsync<IdentityAccount[]>(_jsonOptions, cancellationToken)
                ?? throw new PrivacyBlockedException("identity_admin_invalid_response");
            if (accounts.Length > 100) throw new PrivacyBlockedException("identity_admin_invalid_response");
            foreach (var account in accounts)
            {
                if (string.IsNullOrWhiteSpace(account.Id))
                    throw new PrivacyBlockedException("identity_admin_invalid_response");
                account.Attributes ??= new(StringComparer.Ordinal);
                yield return account;
            }
            if (accounts.Length < 100) yield break;
        }
        throw new PrivacyBlockedException("identity_directory_limit_exceeded");
    }

    private string UserPath(AccountReference account)
    {
        var issuer = ValidateIssuer(_options);
        if (account.Issuer != _options.Issuer || string.IsNullOrWhiteSpace(account.Subject) ||
            account.Subject.Length > 200 || account.Subject is "." or ".." || account.Subject.Any(char.IsControl))
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
        return $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}";
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, CancellationToken cancellationToken)
    {
        var issuer = ValidateIssuer(_options);
        if (string.IsNullOrWhiteSpace(_options.AdminClientId) || string.IsNullOrWhiteSpace(_options.AdminClientSecret))
            throw new PrivacyBlockedException("identity_admin_not_configured");
        var origin = issuer.GetLeftPart(UriPartial.Authority);
        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, _options.Issuer + "/protocol/openid-connect/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials", ["client_id"] = _options.AdminClientId,
                ["client_secret"] = _options.AdminClientSecret
            })
        };
        using var tokenResponse = await _httpClient.SendAsync(tokenRequest, cancellationToken);
        EnsureSuccess(tokenResponse);
        using var token = await JsonDocument.ParseAsync(await tokenResponse.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken);
        if (!token.RootElement.TryGetProperty("access_token", out var tokenValue) ||
            tokenValue.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(tokenValue.GetString()))
            throw new PrivacyBlockedException("identity_admin_invalid_response");
        using var request = new HttpRequestMessage(method, origin + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenValue.GetString());
        if (body is not null) request.Content = JsonContent.Create(body, options: _jsonOptions);
        return await _httpClient.SendAsync(request, cancellationToken);
    }

    private static void EnsureSuccess(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
            throw new PrivacyBlockedException("identity_admin_unavailable");
    }
}
