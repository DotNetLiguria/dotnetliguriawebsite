using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

/// <summary>
/// Represent the OTP requirement
/// Supported names are "mfa" (Google Authenticator) or "hwk" (FIDO2 key)
/// </summary>
/// <param name="Name">The value for "acr_values" to be transmitted
/// to the Identity Provider in order to step-up the authentication</param>
public record OtpRequirement(string Name) : IAuthorizationRequirement;