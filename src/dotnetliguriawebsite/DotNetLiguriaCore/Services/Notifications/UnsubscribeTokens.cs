using System.Security.Cryptography;
using System.Text.Json;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Services.Notifications;

public sealed class UnsubscribeTokens(IDataProtectionProvider provider, TimeProvider clock, IOptions<PrivacyOptions> options)
{
    private readonly IDataProtector _protector = provider.CreateProtector("DotNetLiguria.Notifications.Unsubscribe.v1");
    private readonly TimeProvider _clock = clock;
    private readonly PrivacyOptions _options = options.Value;

    public string Create(AccountReference account, string purpose)
    {
        _ = NotificationConsent.AttributeFor(purpose);
        if (account.Issuer != _options.Issuer) throw new PrivacyBlockedException("foreign_account_reference", 403);
        return _protector.Protect(JsonSerializer.Serialize(new UnsubscribePayload(account, purpose, _clock.GetUtcNow().AddDays(30))));
    }

    public (AccountReference Account, string Purpose) Validate(string token)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 4096)
            throw new PrivacyBlockedException("invalid_unsubscribe_token", 400);
        try
        {
            var payload = JsonSerializer.Deserialize<UnsubscribePayload>(_protector.Unprotect(token));
            if (payload is null || payload.ExpiresAt <= _clock.GetUtcNow() ||
                payload.ExpiresAt > _clock.GetUtcNow().AddDays(30) || payload.Account.Issuer != _options.Issuer ||
                string.IsNullOrWhiteSpace(payload.Account.Subject))
                throw new PrivacyBlockedException("invalid_unsubscribe_token", 400);
            _ = NotificationConsent.AttributeFor(payload.Purpose);
            return (payload.Account, payload.Purpose);
        }
        catch (Exception exception) when (exception is CryptographicException or JsonException)
        {
            throw new PrivacyBlockedException("invalid_unsubscribe_token", 400);
        }
    }
}
