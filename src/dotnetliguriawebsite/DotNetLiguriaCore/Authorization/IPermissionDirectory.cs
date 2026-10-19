using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Authorization;

public interface IPermissionDirectory
{
    Task<IReadOnlySet<string>> GetEffectiveAsync(AccountReference account, CancellationToken cancellationToken);
}
