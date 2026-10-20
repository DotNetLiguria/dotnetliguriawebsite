using System.Security.Cryptography;
using System.Text;
using DotNetLiguriaCore.Services.Privacy;

namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoTarget(string Key, string Name, string? LegacyUrl, bool IsPublic, AccountReference? Account)
{
    public string? Email { get; init; }

    public static string AccountKey(AccountReference account) =>
        "account:" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(account.ActorKey)));
    public static string BoardKey(Guid id) => $"board:{id:D}";
    public static string SpeakerKey(Guid id) => $"speaker:{id:D}";
}
