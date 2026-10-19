using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class KeycloakProfileClient(HttpClient httpClient, IOptions<PrivacyOptions> options,
    PrivacyOperationGate gate, IErasureJournal journal)
{
    private readonly HttpClient _httpClient = httpClient;
    private readonly PrivacyOptions _options = options.Value;
    private readonly PrivacyOperationGate _gate = gate;
    private readonly IErasureJournal _journal = journal;

    public async Task<PersonalIdentity> GetAsync(AccountReference account, string? accessToken,
        CancellationToken cancellationToken)
    {
        using var lease = await _gate.EnterAsync(cancellationToken);
        return (await ReadAsync(account, accessToken, cancellationToken)).Identity;
    }

    public async Task<PersonalIdentity> UpdateAsync(AccountReference account, string? accessToken,
        PersonalIdentityUpdate update, CancellationToken cancellationToken)
    {
        if (!Validator.TryValidateObject(update, new ValidationContext(update), [], validateAllProperties: true) ||
            new[] { update.FirstName, update.LastName }.Any(value => value?.Any(char.IsControl) == true))
            throw new PrivacyBlockedException("profile_update_invalid", StatusCodes.Status400BadRequest);
        using var lease = await _gate.EnterAsync(cancellationToken);
        if (await _journal.FindAsync(account, cancellationToken) is not null)
            throw new PrivacyBlockedException("account_erasure_in_progress", StatusCodes.Status409Conflict);
        var current = await ReadAsync(account, accessToken, cancellationToken);
        var firstName = NormalizeName(update.FirstName);
        var lastName = NormalizeName(update.LastName);
        using var request = CreateRequest(HttpMethod.Post, account, accessToken);
        // The Account API replaces writable attributes. Preserve the server's values,
        // never accept attributes, roles, account IDs or verification flags from callers.
        request.Content = JsonContent.Create(new
        {
            current.Username, firstName, lastName, current.Email, current.Attributes
        });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        EnsureSuccess(response);
        var stored = await ReadAsync(account, accessToken, cancellationToken);
        if (stored.FirstName != firstName || stored.LastName != lastName ||
            stored.Email != current.Email || stored.EmailVerified != current.EmailVerified)
            throw new PrivacyBlockedException("profile_update_not_verified");
        return stored.Identity;
    }

    private async Task<KeycloakAccountProfile> ReadAsync(AccountReference account, string? accessToken,
        CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, account, accessToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        EnsureSuccess(response);
        if (response.Content.Headers.ContentType?.MediaType != "application/json")
            throw new PrivacyBlockedException("profile_invalid_response");
        var profile = await response.Content.ReadFromJsonAsync<KeycloakAccountProfile>(cancellationToken);
        if (profile is null || profile.Id != account.Subject)
            throw new PrivacyBlockedException("profile_invalid_response");
        return profile;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, AccountReference account, string? accessToken)
    {
        var issuer = KeycloakIdentityAccountAdmin.ValidateIssuer(_options);
        if (account.Issuer != issuer.AbsoluteUri || string.IsNullOrWhiteSpace(account.Subject))
            throw new PrivacyBlockedException("foreign_account_reference", StatusCodes.Status403Forbidden);
        if (string.IsNullOrWhiteSpace(accessToken))
            throw new PrivacyBlockedException("profile_session_expired", StatusCodes.Status401Unauthorized);
        var request = new HttpRequestMessage(method, issuer.AbsoluteUri + "/account/");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return request;
    }

    private static string? NormalizeName(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void EnsureSuccess(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode) return;
        throw response.StatusCode switch
        {
            HttpStatusCode.Unauthorized => new PrivacyBlockedException("profile_session_expired", 401),
            HttpStatusCode.Forbidden => new PrivacyBlockedException("profile_edit_forbidden", 403),
            HttpStatusCode.BadRequest or HttpStatusCode.UnprocessableEntity =>
                new PrivacyBlockedException("profile_update_rejected", 400),
            HttpStatusCode.Conflict => new PrivacyBlockedException("profile_update_conflict", 409),
            _ => new PrivacyBlockedException("profile_dependency_unavailable")
        };
    }
}
