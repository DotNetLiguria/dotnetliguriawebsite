using System.Text.Json.Serialization;

namespace DotNetLiguriaCore.Services.Privacy;

public sealed class IdentityAccount
{
    public string Id { get; set; } = "";
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public bool EmailVerified { get; set; }
    public bool Enabled { get; set; }
    public Dictionary<string, string[]> Attributes { get; set; } = new(StringComparer.Ordinal);

    [JsonIgnore]
    public bool CanReceiveNotifications => Enabled && EmailVerified &&
        !string.IsNullOrWhiteSpace(Email) && Email.Length <= 320 &&
        !Email.Any(char.IsControl) && System.Net.Mail.MailAddress.TryCreate(Email, out var address) &&
        string.Equals(address.Address, Email, StringComparison.Ordinal);
}
