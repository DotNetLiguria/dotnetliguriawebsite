
using System.Diagnostics;

using CommonAuth;

using CommonWeb;

using DotNetLiguriaCore.Authorization;

using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.IdentityModel.Tokens;

namespace DotNetLiguriaCore;

public class Program
{
    private const string AuthServerSectionName = "AuthServer";
    private const string CorsPolicy = "DotNetLiguriaCorsPolicy";
    private static readonly string[] AllowedOrigins =
        {
            "https://localhost:3443",
            "http://localhost:3000",
            "https://www.dotnetliguria.net:3443",
            "https://beta.dotnetliguria.net:3443",
        };

    public static void Main(string[] args)
    {
        DotEnv.SetCurrentProfile();

        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddCors(options =>
        {
            options.AddPolicy(CorsPolicy, policy =>
            {
                policy
                    //.AllowAnyOrigin()
                    .WithOrigins(AllowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        ConfigureAuthentication(builder.Services, builder.Configuration);
        ConfigureAuthorization(builder.Services);

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        var app = builder.Build();
        app.UseCors(CorsPolicy);

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            //app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseStaticFiles();
        app.UseRouting();

        app.UseAuthorization();
        //app.MapControllers();
        _ = app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.MapFallbackToFile("/index.html");
        });

        app.Run();
    }

    private static Task Dbg(string caller)
    {
        Debug.WriteLine(caller);
        return Task.CompletedTask;
    }

    private static void ConfigureAuthentication(IServiceCollection services,
        ConfigurationManager configuration)
    {
        var authServerSection = configuration.GetSection(AuthServerSectionName);
        services.Configure<AuthServerConfiguration>(authServerSection);
        var authServerConfig = authServerSection.Get<AuthServerConfiguration>();

        if(authServerConfig == null)
        {
            throw new InvalidOperationException(
                $"The configuraton '{AuthServerSectionName}' cannot be found");
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
            options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;

            options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
        })
        .AddKeycloak(authServerConfig, new OpenIdConnectEvents()
        {
            OnRedirectToIdentityProvider = ctx =>
            {
                // specify additional parameters here
                if (ctx.HttpContext.Items.TryGetValue("acr", out object? value))
                {
                    var acr = value as string ?? string.Empty;  // "mfa"
                    ctx.ProtocolMessage.SetParameter("acr_values", acr);
                }

                return Task.CompletedTask;
            },

            OnRedirectToIdentityProviderForSignOut = ctx => Dbg("OnRedirectToIdentityProviderForSignOut"),

            OnAccessDenied = ctx => Dbg($"OIDC: OnAccessDenied"),
            OnAuthenticationFailed = ctx => Dbg($"OIDC: OnAuthenticationFailed"),
            OnAuthorizationCodeReceived = ctx => Dbg($"OIDC: OnAuthorizationCodeReceived"),
            OnMessageReceived = ctx => Dbg($"OIDC: OnMessageReceived"),
            OnRemoteSignOut = ctx => Dbg($"OIDC: OnRemoteSignOut"),
            OnSignedOutCallbackRedirect = ctx => Dbg($"OIDC: OnSignedOutCallbackRedirect"),
            OnTicketReceived = ctx => Dbg($"OIDC: OnTicketReceived"),
            OnTokenResponseReceived = ctx => Dbg($"OIDC: OnTokenResponseReceived"),
            OnTokenValidated = ctx => Dbg($"OIDC: OnTokenValidated"),
            OnUserInformationReceived = ctx =>
            {
                //var tokens = ctx.Properties.GetTokens().ToList();
                //var access_token = tokens.FirstOrDefault(t => t.Name == "access_token");
                //var id_token = tokens.FirstOrDefault(t => t.Name == "id_token");
                //if (access_token != null && id_token != null)
                //{
                //    tokens.Remove(id_token);
                //    ctx.Properties.StoreTokens(tokens);
                //}

                return Dbg($"OIDC: OnUserInformationReceived");
            },

            OnRemoteFailure = ctx =>
            {
                // apparently this OIDC client does not handle 'error_uri'

                // ctx.Failure contains the error message
                // we should redirect to a page that shows the message

                //ctx.Response.Redirect("/");
                //ctx.HandleResponse();
                return Task.CompletedTask;
            }

        })
        .AddJwtBearer(options =>
        {
            options.MetadataAddress = authServerConfig.MetadataAddress;
            options.RequireHttpsMetadata = false;
            options.Audience = authServerConfig.Audience;
            options.Authority = authServerConfig.Authority;
            options.Events = new JwtBearerEvents()
            {
                OnChallenge = x => Dbg($"JWT: Challenge "),
                OnMessageReceived = x => Dbg($"JWT: OnMessageReceived "),
                OnAuthenticationFailed = x => Dbg($"JWT: {x.Exception.ToString()}"),
                OnTokenValidated = x => Dbg($"JWT: Token has been validated: {x.Result}"),
                OnForbidden = x => Dbg($"JWT: Forbidden"),
            };

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ClockSkew = TimeSpan.FromMinutes(5),
            };

            // Never disable these validations:
            options.TokenValidationParameters.ValidateIssuer = true;
            options.TokenValidationParameters.ValidateAudience = true;
        });

    }

    private static void ConfigureAuthorization(IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddAuthorization(options =>
        {
            options.AddPolicy("mfa",
                policy => policy.Requirements.Add(new OtpRequirement("mfa")));

            options.AddPolicy("hwk",
                policy => policy.Requirements.Add(new OtpRequirement("hwk")));
        });

        services.AddScoped<IAuthorizationHandler, OtpRequirementHandler>();
    }
}