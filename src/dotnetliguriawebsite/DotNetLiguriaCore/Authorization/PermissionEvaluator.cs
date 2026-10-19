using System.Collections.Frozen;
using System.Security.Claims;
using DotNetLiguriaCore.Services.Privacy;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Authorization;

public sealed class PermissionEvaluator(IPermissionDirectory directory, IOptions<PrivacyOptions> options)
{
    private readonly IPermissionDirectory _directory = directory;
    private readonly PrivacyOptions _options = options.Value;
    private Task<IReadOnlySet<string>>? _permissions;
    private ClaimsPrincipal? _principal;

    public Task<IReadOnlySet<string>> GetAsync(ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        if (!ReferenceEquals(_principal, principal))
        {
            _principal = principal;
            _permissions = ResolveAsync(principal, cancellationToken);
        }
        return _permissions!;
    }

    private async Task<IReadOnlySet<string>> ResolveAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var token = PermissionClaims.Read(principal);
        if (token.Count == 0) return FrozenSet<string>.Empty;
        var account = AccountReference.FromPrincipal(principal, _options.Issuer);
        var live = await _directory.GetEffectiveAsync(account, cancellationToken);
        return token.Where(live.Contains).ToFrozenSet(StringComparer.Ordinal);
    }
}
