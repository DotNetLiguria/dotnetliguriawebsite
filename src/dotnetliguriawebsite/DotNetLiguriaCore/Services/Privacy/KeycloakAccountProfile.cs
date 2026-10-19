namespace DotNetLiguriaCore.Services.Privacy;

internal sealed record KeycloakAccountProfile(
    string Id, string? Username, string? FirstName, string? LastName,
    string? Email, bool EmailVerified, Dictionary<string, string[]>? Attributes)
{
    public PersonalIdentity Identity => new(FirstName, LastName, Email, EmailVerified);
}
