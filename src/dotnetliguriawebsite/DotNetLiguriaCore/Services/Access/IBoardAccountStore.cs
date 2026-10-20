using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Access;

public interface IBoardAccountStore
{
    Task<Board?> GetAsync(Guid id);
    Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken);
}
