using System.Collections.Frozen;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Access;

public sealed class KeycloakPermissionDirectory(HttpClient httpClient, IOptions<PermissionDirectoryOptions> options)
    : IAccessPermissionDirectory
{
    private const int _maxRoleMappings = 512;
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        MaxDepth = 24
    };
    private readonly HttpClient _httpClient = httpClient;
    private readonly PermissionDirectoryOptions _options = options.Value;
    private string? _clientUuid;
    private string? _serviceToken;
    private DateTimeOffset _serviceTokenExpiresAt;
    private readonly Dictionary<string, string> _roleIds = new(StringComparer.Ordinal);

    public async Task<IReadOnlySet<string>> GetEffectiveAsync(AccountReference account, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var clientId = await GetClientUuidAsync(cancellationToken);
        var roles = await ReadRoleMappingsAsync(account, clientId, effective: true, cancellationToken);
        return roles;
    }

    public async Task<IReadOnlyList<AccessUserSummary>> SearchUsersAsync(
        string search, int first, int max, CancellationToken cancellationToken)
    {
        ValidateSearch(search, first, max);
        var issuer = ValidateIssuer(_options);
        var filter = string.IsNullOrWhiteSpace(search) ? "" : $"search={Uri.EscapeDataString(search.Trim())}&";
        var path = $"/admin{issuer.AbsolutePath}/users?{filter}first={first}&max={max}&briefRepresentation=false";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() > max)
            throw new PrivacyBlockedException("permission_directory_invalid_response");

        var users = new List<AccessUserSummary>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var user = ParseUser(item);
            users.Add(new(_options.Issuer, user.Subject, user.Username, user.Enabled,
                user.IsServiceAccount ? true : null));
        }
        return users;
    }

    public async Task<IReadOnlyList<AccessUserSummary>> FindUsersByEmailAsync(
        string email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 320 || email.Any(char.IsControl))
            throw new PrivacyBlockedException("invalid_access_search", StatusCodes.Status400BadRequest);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users?email={Uri.EscapeDataString(email.Trim())}&exact=true&first=0&max=51&briefRepresentation=false";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() >= 51)
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        var users = new List<AccessUserSummary>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var user = ParseUser(item);
            if (!user.IsServiceAccount && TryGetString(item, "email", out var actualEmail) &&
                string.Equals(actualEmail.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase))
                users.Add(new(_options.Issuer, user.Subject, user.Username, user.Enabled));
        }
        return users;
    }

    public async Task<(AccessUserSummary User, bool IsServiceAccount)> GetUserAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}?briefRepresentation=false";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new PrivacyBlockedException("access_target_not_found", StatusCodes.Status404NotFound);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        var parsed = ParseUser(document.RootElement);
        if (!string.Equals(parsed.Subject, account.Subject, StringComparison.Ordinal))
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        return (new(_options.Issuer, parsed.Subject, parsed.Username, parsed.Enabled), parsed.IsServiceAccount);
    }

    public async Task<PermissionAssignmentSnapshot> GetAssignmentsAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var clientId = await GetClientUuidAsync(cancellationToken);
        var direct = await ReadRoleMappingsAsync(account, clientId, effective: false, cancellationToken);
        var effective = await ReadRoleMappingsAsync(account, clientId, effective: true, cancellationToken);
        var groupRoles = await ReadGroupRoleMappingsAsync(account, cancellationToken);
        var inherited = effective.Except(direct, StringComparer.Ordinal)
            .Concat(groupRoles.Where(effective.Contains))
            .ToFrozenSet(StringComparer.Ordinal);
        return new(direct, inherited, effective);
    }

    public async Task<bool> IsProtectedByConfiguredGroupAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var protectedIds = ValidateProtectedGroupIds(_options);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}/groups?first=0&max=100";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() >= 100)
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        foreach (var group in document.RootElement.EnumerateArray())
        {
            if (group.ValueKind != JsonValueKind.Object ||
                !group.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(id.GetString(), out var groupId))
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            if (protectedIds.Contains(groupId.ToString("D")))
                return true;
        }
        return false;
    }

    public async Task<bool> IsProtectedByApplicationRoleAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        var effective = await GetEffectiveAsync(account, cancellationToken);
        return effective.Any(permission => permission.StartsWith("access.", StringComparison.Ordinal) ||
            permission.StartsWith("maintenance.", StringComparison.Ordinal) ||
            permission.StartsWith("privacy.", StringComparison.Ordinal) ||
            permission == "backups.restore");
    }

    public async Task ChangeDirectPermissionAsync(
        AccountReference account, string permission, bool grant, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        if (!PermissionDelegationPolicy.IsDelegable(permission))
            throw new PrivacyBlockedException("permission_not_delegable", StatusCodes.Status403Forbidden);
        var clientId = await GetClientUuidAsync(cancellationToken);
        var role = await GetClientRoleAsync(clientId, permission, cancellationToken);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}/role-mappings/clients/{clientId}";
        using var response = await SendAdminAsync(grant ? HttpMethod.Post : HttpMethod.Delete, path,
            new[] { new { id = role.Id, name = role.Name } }, cancellationToken);
        EnsureSuccess(response);
    }

    private async Task<IReadOnlySet<string>> ReadRoleMappingsAsync(
        AccountReference account, string clientId, bool effective, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var issuer = ValidateIssuer(_options);
        var suffix = effective ? "/composite" : "";
        var path = $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}" +
            $"/role-mappings/clients/{clientId}{suffix}";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new PrivacyBlockedException("access_target_not_found", StatusCodes.Status404NotFound);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() > _maxRoleMappings)
            throw new PrivacyBlockedException("permission_directory_invalid_response");

        var permissions = new HashSet<string>(StringComparer.Ordinal);
        foreach (var role in document.RootElement.EnumerateArray())
        {
            if (role.ValueKind != JsonValueKind.Object ||
                !TryGetString(role, "name", out var name) ||
                !TryGetString(role, "id", out _) ||
                !TryGetString(role, "containerId", out var containerId) ||
                !string.Equals(containerId, clientId, StringComparison.Ordinal) ||
                !role.TryGetProperty("clientRole", out var clientRole) ||
                clientRole.ValueKind != JsonValueKind.True ||
                !role.TryGetProperty("composite", out var composite) ||
                composite.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            if (!PermissionCatalog.IsKnown(name)) continue;
            if (composite.ValueKind != JsonValueKind.False)
                throw new PrivacyBlockedException("permission_directory_invalid_role");
            permissions.Add(name);
        }
        return permissions.ToFrozenSet(StringComparer.Ordinal);
    }

    private async Task<IReadOnlySet<string>> ReadGroupRoleMappingsAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users/{Uri.EscapeDataString(account.Subject)}/groups?first=0&max=100&briefRepresentation=false";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() >= 100)
            throw new PrivacyBlockedException("permission_directory_invalid_response");

        var permissions = new HashSet<string>(StringComparer.Ordinal);
        foreach (var group in document.RootElement.EnumerateArray())
        {
            if (group.ValueKind != JsonValueKind.Object ||
                !group.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(id.GetString(), out _))
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            if (!group.TryGetProperty("clientRoles", out var clientRoles))
                continue;
            if (clientRoles.ValueKind != JsonValueKind.Object)
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            if (!clientRoles.TryGetProperty(_options.ApplicationClientId, out var appRoles))
                continue;
            if (appRoles.ValueKind != JsonValueKind.Array || appRoles.GetArrayLength() > PermissionCatalog.Ids.Count * 2)
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            foreach (var role in appRoles.EnumerateArray())
            {
                if (role.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(role.GetString()))
                    throw new PrivacyBlockedException("permission_directory_invalid_response");
                var permission = role.GetString()!;
                if (PermissionCatalog.IsKnown(permission))
                    permissions.Add(permission);
            }
        }
        return permissions.ToFrozenSet(StringComparer.Ordinal);
    }

    private async Task<string> GetClientUuidAsync(CancellationToken cancellationToken)
    {
        if (_clientUuid is not null) return _clientUuid;
        if (!string.Equals(_options.ApplicationClientId, "DotNetLiguriaCore", StringComparison.Ordinal))
            throw new PrivacyBlockedException("permission_directory_not_configured");
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/clients?clientId={Uri.EscapeDataString(_options.ApplicationClientId)}";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (document.RootElement.ValueKind != JsonValueKind.Array ||
            document.RootElement.GetArrayLength() != 1)
            throw new PrivacyBlockedException("permission_directory_client_not_found");
        var client = document.RootElement[0];
        if (!TryGetString(client, "id", out var id) || !Guid.TryParse(id, out var clientGuid) ||
            !TryGetString(client, "clientId", out var actualClientId) ||
            !string.Equals(actualClientId, _options.ApplicationClientId, StringComparison.Ordinal))
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        _clientUuid = clientGuid.ToString("D");
        return _clientUuid;
    }

    private async Task<(string Id, string Name)> GetClientRoleAsync(
        string clientId, string permission, CancellationToken cancellationToken)
    {
        if (_roleIds.TryGetValue(permission, out var existingId))
            return (existingId, permission);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/clients/{clientId}/roles/{Uri.EscapeDataString(permission)}";
        using var response = await SendAdminAsync(HttpMethod.Get, path, null, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new PrivacyBlockedException("permission_role_not_configured");
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (!TryGetString(document.RootElement, "id", out var id) || !Guid.TryParse(id, out var roleGuid) ||
            !TryGetString(document.RootElement, "name", out var name) ||
            !string.Equals(name, permission, StringComparison.Ordinal) ||
            !TryGetString(document.RootElement, "containerId", out var container) ||
            !string.Equals(container, clientId, StringComparison.Ordinal) ||
            !document.RootElement.TryGetProperty("clientRole", out var clientRole) ||
            clientRole.ValueKind != JsonValueKind.True ||
            !document.RootElement.TryGetProperty("composite", out var composite) ||
            composite.ValueKind != JsonValueKind.False)
            throw new PrivacyBlockedException("permission_directory_invalid_role");
        existingId = roleGuid.ToString("D");
        _roleIds.Add(permission, existingId);
        return (existingId, permission);
    }

    private async Task<HttpResponseMessage> SendAdminAsync(
        HttpMethod method, string path, object? body, CancellationToken cancellationToken)
    {
        var token = await GetServiceTokenAsync(cancellationToken);
        var issuer = ValidateIssuer(_options);
        var request = new HttpRequestMessage(method, issuer.GetLeftPart(UriPartial.Authority) + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body is not null)
            request.Content = JsonContent.Create(body, options: _jsonOptions);
        try
        {
            return await SendHttpAsync(request, cancellationToken);
        }
        finally
        {
            request.Dispose();
        }
    }

    private async Task<string> GetServiceTokenAsync(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        if (_serviceToken is not null && _serviceTokenExpiresAt > now.AddSeconds(30))
            return _serviceToken;
        if (string.IsNullOrWhiteSpace(_options.ServiceClientId) ||
            string.IsNullOrWhiteSpace(_options.ServiceClientSecret) ||
            !string.IsNullOrWhiteSpace(_options.PrivacyAdminClientId) &&
                string.Equals(_options.ServiceClientId, _options.PrivacyAdminClientId, StringComparison.Ordinal) ||
            !string.IsNullOrWhiteSpace(_options.PrivacyAdminClientSecret) &&
                string.Equals(_options.ServiceClientSecret, _options.PrivacyAdminClientSecret, StringComparison.Ordinal))
            throw new PrivacyBlockedException("permission_directory_not_configured");
        var issuer = ValidateIssuer(_options);
        using var request = new HttpRequestMessage(HttpMethod.Post,
            issuer.AbsoluteUri + "/protocol/openid-connect/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _options.ServiceClientId,
                ["client_secret"] = _options.ServiceClientSecret
            })
        };
        using var response = await SendHttpAsync(request, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        if (!TryGetString(document.RootElement, "access_token", out var accessToken) ||
            string.IsNullOrWhiteSpace(accessToken) ||
            !document.RootElement.TryGetProperty("expires_in", out var expires) ||
            !expires.TryGetInt32(out var expiresIn) || expiresIn <= 0 || expiresIn > 86400)
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        _serviceToken = accessToken;
        _serviceTokenExpiresAt = now.AddSeconds(expiresIn);
        return accessToken;
    }

    private static async Task<JsonDocument> ReadJsonAsync(
        HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.Content.Headers.ContentType?.MediaType != "application/json")
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        try
        {
            return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken),
                new JsonDocumentOptions { MaxDepth = 24 }, cancellationToken);
        }
        catch (Exception exception) when (exception is JsonException or IOException)
        {
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        }
    }

    private async Task<HttpResponseMessage> SendHttpAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        try
        {
            return await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            throw new PrivacyBlockedException("permission_directory_unavailable");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new PrivacyBlockedException("permission_directory_unavailable");
        }
    }

    private static (string Subject, string? Username, bool Enabled, bool IsServiceAccount) ParseUser(JsonElement user)
    {
        if (user.ValueKind != JsonValueKind.Object ||
            !TryGetString(user, "id", out var subject) || !Guid.TryParse(subject, out var subjectGuid) ||
            !user.TryGetProperty("enabled", out var enabled) ||
            enabled.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        string? username = null;
        if (user.TryGetProperty("username", out var usernameElement) &&
            usernameElement.ValueKind != JsonValueKind.Null)
        {
            if (usernameElement.ValueKind != JsonValueKind.String ||
                usernameElement.GetString()!.Length > 160 || usernameElement.GetString()!.Any(char.IsControl))
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            username = usernameElement.GetString();
        }
        var serviceAccount = user.TryGetProperty("serviceAccountClientId", out var serviceAccountId) &&
            serviceAccountId.ValueKind == JsonValueKind.String &&
            !string.IsNullOrWhiteSpace(serviceAccountId.GetString());
        return (subjectGuid.ToString("D"), username, enabled.ValueKind == JsonValueKind.True, serviceAccount);
    }

    private static void ValidateSearch(string search, int first, int max)
    {
        if (search.Length > 100 || search.Any(char.IsControl) ||
            first < 0 || first > 10000 || max is < 1 or > 51)
            throw new PrivacyBlockedException("invalid_access_search", StatusCodes.Status400BadRequest);
    }

    private static Uri ValidateIssuer(PermissionDirectoryOptions options)
    {
        if (!Uri.TryCreate(options.Issuer, UriKind.Absolute, out var issuer) ||
            issuer.Scheme != Uri.UriSchemeHttps || issuer.Port != 443 || issuer.UserInfo.Length != 0 ||
            issuer.Query.Length != 0 || issuer.Fragment.Length != 0 || issuer.AbsoluteUri != options.Issuer ||
            !string.Equals(issuer.IdnHost, options.AllowedIdentityHost, StringComparison.OrdinalIgnoreCase) ||
            Uri.CheckHostName(issuer.IdnHost) != UriHostNameType.Dns)
            throw new PrivacyBlockedException("permission_directory_not_configured");
        var parts = issuer.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || parts[0] != "realms" || parts[1].Length > 100 ||
            parts[1].Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_') ||
            issuer.AbsolutePath != "/realms/" + parts[1])
            throw new PrivacyBlockedException("permission_directory_not_configured");
        return issuer;
    }

    private static HashSet<string> ValidateProtectedGroupIds(PermissionDirectoryOptions options)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var value in options.ProtectedGroupIds)
        {
            if (!Guid.TryParse(value, out var groupId))
                throw new PrivacyBlockedException("permission_directory_not_configured");
            ids.Add(groupId.ToString("D"));
        }
        if (ids.Count == 0)
            throw new PrivacyBlockedException("permission_directory_not_configured");
        return ids;
    }

    private void ValidateAccount(AccountReference account)
    {
        ValidateIssuer(_options);
        if (!string.Equals(account.Issuer, _options.Issuer, StringComparison.Ordinal) ||
            !Guid.TryParse(account.Subject, out var subjectGuid))
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
    }

    private static bool TryGetString(JsonElement element, string property, out string value)
    {
        value = "";
        return element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(property, out var member) &&
            member.ValueKind == JsonValueKind.String &&
            !string.IsNullOrWhiteSpace(value = member.GetString()!);
    }

    private static void EnsureSuccess(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
            throw new PrivacyBlockedException("permission_directory_unavailable");
    }
}
