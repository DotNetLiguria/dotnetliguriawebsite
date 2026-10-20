using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Tests.Access;

internal sealed class FakeBoardAccountStore : IBoardAccountStore
{
    public Board Profile { get; } = new() { BoardId = Guid.NewGuid(), Email = "board@example.test", Description = "Presidente" };
    public bool DuplicateAccount { get; set; }
    public int Writes { get; private set; }
    public Task<Board?> GetAsync(Guid id) => Task.FromResult<Board?>(id == Profile.BoardId ? Profile : null);
    public Task LinkAsync(Guid id, AccountReference account, string? expectedEmail, CancellationToken cancellationToken)
    {
        if (DuplicateAccount) throw new PrivacyBlockedException("board_account_already_linked", 409);
        if (id != Profile.BoardId || Profile.Email != expectedEmail || Profile.AccountSubject is not null)
            throw new PrivacyBlockedException("board_profile_changed", 409);
        Profile.AccountIssuer = account.Issuer;
        Profile.AccountSubject = account.Subject;
        Writes++;
        return Task.CompletedTask;
    }
}
