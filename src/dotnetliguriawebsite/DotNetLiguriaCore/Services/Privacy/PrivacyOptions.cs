namespace DotNetLiguriaCore.Services.Privacy;

public sealed class PrivacyOptions
{
    public string Issuer { get; set; } = "";
    public string AllowedIdentityHost { get; set; } = "hello.vevy.com";
    public string AdminClientId { get; set; } = "";
    public string AdminClientSecret { get; set; } = "";
    public string AuthorizationClientId { get; set; } = "DotNetLiguriaCore";
    public string AdministratorRole { get; set; } = "";
    public string NotificationAdministratorRole { get; set; } = "";
    public string ConsentVersion { get; set; } = "";
    public bool ProtectedStorageApproved { get; set; }
    public bool ExternalCopiesErasureApproved { get; set; }
    public bool IdentityAttributePermissionsApproved { get; set; }
    public Dictionary<string, string> RetentionOverrides { get; set; } = new(StringComparer.Ordinal);
    public string[] AssessedNonAccountCollections { get; set; } = [];
}
