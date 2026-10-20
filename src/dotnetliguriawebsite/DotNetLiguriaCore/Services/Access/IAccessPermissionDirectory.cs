using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Access;

public interface IAccessPermissionDirectory : IPermissionDirectory
{
    Task<IReadOnlyList<AccessUserSummary>> SearchUsersAsync(
        string search, int first, int max, CancellationToken cancellationToken);
    Task<IReadOnlyList<AccessUserSummary>> FindUsersByEmailAsync(
        string email, CancellationToken cancellationToken);
    Task<(AccessUserSummary User, bool IsServiceAccount)> GetUserAsync(
        AccountReference account, CancellationToken cancellationToken);
    Task<PermissionAssignmentSnapshot> GetAssignmentsAsync(
        AccountReference account, CancellationToken cancellationToken);
    Task<bool> IsProtectedByConfiguredGroupAsync(
        AccountReference account, CancellationToken cancellationToken);
    Task ChangeDirectPermissionAsync(
        AccountReference account, string permission, bool grant, CancellationToken cancellationToken);
}
