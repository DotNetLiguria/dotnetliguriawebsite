using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonAuth;

public class AuthServerConfiguration
{
    /// <summary>
    /// Clients/(client)
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// Clients/(client)/Credentials/Secret
    /// </summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// Audience is needed to the SPA otherwise the token cannot be used
    /// </summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// The Keycloak url publishing the openid metadata
    /// https://myKeycloak/realms/MyRealm/.well-known/openid-configuration
    /// </summary>
    public string MetadataAddress { get; set; } = string.Empty;

    /// <summary>
    /// Realm Settings/Endpoints/OpenID Endpoint Configuration/"issuer"
    /// The realm where the client is configured on KeyCloak
    /// For example: "https://myKecloak/realms/MyRealm"
    /// </summary>
    public string Authority { get; set; } = string.Empty;

    /// <summary>
    /// Normally, this should never be changed
    /// "/signin-oidc" => is the endpoint for the OpenIdConnect handler
    /// The default OpenIdConnectOptions.CallbackPath is already "/signin-oidc"
    /// </summary>
    public string CallbackPath { get; set; } = "/signin-oidc";

    /// <summary>
    /// The application page where the user is redirected to, after logging in (using the Challenge method)
    /// It is fundamental redirecting to an application page and not "signin-oidc"
    /// When this path is wrong, we can get the error: "OpenIdConnectAuthenticationHandler: message.State is null or empty."
    /// </summary>
    public string SignInPath { get; set; } = "/";

    /// <summary>
    /// The application page where the user is redirected to, after logging out (using the SignOut method)
    /// </summary>
    public string SignOutPath { get; set; } = "/";

    public string[] Scopes { get; set; } = Array.Empty<string>();
}
