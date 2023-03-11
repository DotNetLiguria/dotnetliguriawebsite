using System.IdentityModel.Tokens.Jwt;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace CommonAuth;

public static class KeycloakServiceExtensions
{
    public static AuthenticationBuilder AddKeycloak(this AuthenticationBuilder authenticationBuilder,
    AuthServerConfiguration authServerConfiguration,
    OpenIdConnectEvents openIdConnectEvents)
    {
        authenticationBuilder
          .AddCookie(options =>
          {
              //options.Cookie.SameSite = SameSiteMode.None;
              //options.Cookie.Name = "AuthCookie";
              //options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
              //options.AccessDeniedPath

              options.Cookie.SameSite = SameSiteMode.None;
              options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
              options.Cookie.IsEssential = true;
              options.Events = new CookieAuthenticationEvents()
              {
                  OnRedirectToAccessDenied = async ctx =>
                  {
                      // The default page for the Access Denied (HTTP 403):
                      // https://localhost:5001/Account/AccessDenied?ReturnUrl=%2FHome%2FSecret

                      if (ctx.HttpContext.Items["acr"] != null)
                      {
                          await ctx.HttpContext.ChallengeAsync();
                      }
                      else
                      {
                          // TODO: invoke custom page
                      }
                  }
              };
          })
          .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, (options) =>
          {
              var jwtHandler = new JwtSecurityTokenHandler();
              jwtHandler.InboundClaimFilter.Clear();
              jwtHandler.InboundClaimTypeMap.Clear();
              options.SecurityTokenValidator = jwtHandler;

              options.ClientId = authServerConfiguration.ClientId;
              options.ClientSecret = authServerConfiguration.ClientSecret;
              options.Authority = authServerConfiguration.Authority;

              options.ResponseType = OpenIdConnectResponseType.Code;// => standard flow only

              options.RequireHttpsMetadata = false;
              options.SaveTokens = true;
              options.Events = openIdConnectEvents;
              options.GetClaimsFromUserInfoEndpoint = true;
              options.UsePkce = true;

              // SameSite options
              options.NonceCookie.SameSite = SameSiteMode.Unspecified;
              options.CorrelationCookie.SameSite = SameSiteMode.Unspecified;

              if (authServerConfiguration.Scopes != null)
              {
                  foreach (var scope in authServerConfiguration.Scopes)
                      options.Scope.Add(scope);
              }

              options.AccessDeniedPath = "/";

              options.RemoteSignOutPath = "/signout-remote/";
              //options.SignedOutCallbackPath = "/signout-remote/";
              //options.SignOutScheme = CookieAuthenticationDefaults.AuthenticationScheme;//OpenIdConnectDefaults.AuthenticationScheme;

              options.ClaimActions.Clear();
              options.ClaimActions.MapUniqueJsonKey("realm_access", "realm_access");
              options.ClaimActions.MapUniqueJsonKey("realm_access.roles", "roles1");
              options.ClaimActions.MapUniqueJsonKey("roles", "roles0");
              options.ClaimActions.MapUniqueJsonKey("realm_access_roles", "roles2");
          });


        return authenticationBuilder;
    }

    public static ChallengeResult SignIn(this ControllerBase controller,
        AuthServerConfiguration authServerConfiguration)
    {
        var signInPath = new PathString(authServerConfiguration.SignInPath);
        return controller.Challenge(new AuthenticationProperties() { RedirectUri = signInPath },
            OpenIdConnectDefaults.AuthenticationScheme);//,
                                                        //CookieAuthenticationDefaults.AuthenticationScheme);
    }

    public static SignOutResult SignOut(this ControllerBase controller,
        AuthServerConfiguration authServerConfiguration)
    {
        var signOutPath = new PathString(authServerConfiguration.SignOutPath);
        return controller.SignOut(new AuthenticationProperties() { RedirectUri = signOutPath },
            OpenIdConnectDefaults.AuthenticationScheme,
            CookieAuthenticationDefaults.AuthenticationScheme);
    }
}