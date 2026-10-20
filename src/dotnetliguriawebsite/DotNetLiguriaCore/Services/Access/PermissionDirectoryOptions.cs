namespace DotNetLiguriaCore.Services.Access;

public sealed class PermissionDirectoryOptions
{
    public string Issuer { get; set; } = "";
    public string AllowedIdentityHost { get; set; } = "hello.vevy.com";
    public string ServiceClientId { get; set; } = "";
    public string ServiceClientSecret { get; set; } = "";
    public string ApplicationClientId { get; set; } = "DotNetLiguriaCore";
    public string[] ProtectedGroupIds { get; set; } = [];
    public string BoardGroupId { get; set; } = "";
    public string InvitationClientId { get; set; } = "";
    public string InvitationRedirectUri { get; set; } = "";
    public string[] AllowedInvitationRedirectUris { get; set; } = [];
    public int InvitationLifespanSeconds { get; set; } = 1800;
    internal string PrivacyAdminClientId { get; set; } = "";
    internal string PrivacyAdminClientSecret { get; set; } = "";
}
