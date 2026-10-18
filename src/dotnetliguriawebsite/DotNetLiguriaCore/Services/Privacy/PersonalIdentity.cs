namespace DotNetLiguriaCore.Services.Privacy;

public sealed record PersonalIdentity(string? FirstName, string? LastName, string? Email, bool EmailVerified);
