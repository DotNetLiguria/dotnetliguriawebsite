using System.Net;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Access;

public sealed partial class KeycloakPermissionDirectory
{
    public void ValidateInvitationConfiguration()
    {
        ValidateIssuer(_options);
        if (_options.InvitationClientId != _options.ApplicationClientId ||
            string.IsNullOrWhiteSpace(_options.InvitationClientId) ||
            !Uri.TryCreate(_options.InvitationRedirectUri, UriKind.Absolute, out var redirect) ||
            redirect.Scheme != Uri.UriSchemeHttps || redirect.UserInfo.Length != 0 ||
            redirect.Fragment.Length != 0 ||
            !_options.AllowedInvitationRedirectUris.Contains(_options.InvitationRedirectUri, StringComparer.Ordinal) ||
            _options.InvitationLifespanSeconds is < 300 or > 86400)
            throw new PrivacyBlockedException("speaker_invitation_not_configured");
    }

    public async Task<AccountReference> CreateSpeakerAccountAsync(string email, CancellationToken cancellationToken)
    {
        ValidateInvitationConfiguration();
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users";
        using var response = await SendAdminAsync(HttpMethod.Post, path,
            new { username = email, email, enabled = true, emailVerified = false,
                requiredActions = new[] { "UPDATE_PASSWORD", "VERIFY_EMAIL" } }, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Conflict)
            throw new PrivacyBlockedException("speaker_account_create_conflict", 409);
        if (response.StatusCode != HttpStatusCode.Created ||
            response.Headers.Location is not { } location)
            throw new PrivacyBlockedException("speaker_account_create_uncertain");
        var absolute = location.IsAbsoluteUri ? location : new Uri(issuer, location);
        var prefix = issuer.GetLeftPart(UriPartial.Authority) + path + "/";
        if (!absolute.AbsoluteUri.StartsWith(prefix, StringComparison.Ordinal) ||
            !Guid.TryParseExact(absolute.AbsoluteUri[prefix.Length..], "D", out var subject) || subject == Guid.Empty)
            throw new PrivacyBlockedException("speaker_account_create_uncertain");
        return new(_options.Issuer, subject.ToString("D"));
    }

    public async Task<SpeakerInvitationAccount> ReadInvitationAccountAsync(
        AccountReference account, CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        var issuer = ValidateIssuer(_options);
        using var response = await SendAdminAsync(HttpMethod.Get,
            $"/admin{issuer.AbsolutePath}/users/{account.Subject}", null, cancellationToken);
        EnsureSuccess(response);
        using var document = await ReadJsonAsync(response, cancellationToken);
        var root = document.RootElement;
        var user = ParseUser(root);
        if (user.Subject != account.Subject || !TryGetString(root, "email", out var email) ||
            !root.TryGetProperty("emailVerified", out var verified) ||
            verified.ValueKind is not (System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False) ||
            !root.TryGetProperty("requiredActions", out var actions) ||
            actions.ValueKind != System.Text.Json.JsonValueKind.Array)
            throw new PrivacyBlockedException("permission_directory_invalid_response");
        var pending = new HashSet<string>(StringComparer.Ordinal);
        foreach (var action in actions.EnumerateArray())
        {
            if (action.ValueKind != System.Text.Json.JsonValueKind.String)
                throw new PrivacyBlockedException("permission_directory_invalid_response");
            if (action.GetString() is "UPDATE_PASSWORD" or "VERIFY_EMAIL")
                pending.Add(action.GetString()!);
        }
        if (verified.ValueKind == System.Text.Json.JsonValueKind.False) pending.Add("VERIFY_EMAIL");
        else pending.Remove("VERIFY_EMAIL");
        return new(email, user.Enabled, user.IsServiceAccount, pending.Order(StringComparer.Ordinal).ToArray());
    }

    public async Task SendSpeakerInvitationAsync(AccountReference account, IReadOnlyList<string> actions,
        CancellationToken cancellationToken)
    {
        ValidateAccount(account);
        ValidateInvitationConfiguration();
        if (actions.Count is < 1 or > 2 || actions.Any(action => action is not ("UPDATE_PASSWORD" or "VERIFY_EMAIL")) ||
            actions.Distinct(StringComparer.Ordinal).Count() != actions.Count)
            throw new PrivacyBlockedException("speaker_invitation_actions_invalid", 409);
        var issuer = ValidateIssuer(_options);
        var path = $"/admin{issuer.AbsolutePath}/users/{account.Subject}/execute-actions-email" +
            $"?client_id={Uri.EscapeDataString(_options.InvitationClientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.InvitationRedirectUri)}" +
            $"&lifespan={_options.InvitationLifespanSeconds}";
        using var response = await SendAdminAsync(HttpMethod.Put, path, actions, cancellationToken);
        if (response.StatusCode != HttpStatusCode.NoContent)
            throw new PrivacyBlockedException("speaker_invitation_unverified");
    }
}
