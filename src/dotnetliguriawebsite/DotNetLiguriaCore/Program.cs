using System.Diagnostics;

using CommonAuth;

using CommonWeb;

using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using DotNetLiguria.ServiceDefaults;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

namespace DotNetLiguriaCore;

public class Program
{
    private const string _authServerSectionName = "AuthServer";
    private const string _corsPolicy = "DotNetLiguriaCorsPolicy";
    private static readonly string[] _allowedOrigins =
        {
            "https://localhost:3443",
            "http://localhost:3000",
            "https://www.dotnetliguria.net:3443",
            "https://beta.dotnetliguria.net:3443",
            "https://beta.dotnetliguria.net",
        };

    public static void Main(string[] args)
    {
        global::DotNetLiguriaCore.Model.BsonCompatibility.Configure();
#if DEBUG
        Console.WriteLine("This is a debug build");
        //IdentityModelEventSource.ShowPII = true;
        if (Environment.GetEnvironmentVariable("DOTNET_LIGURIA_ASPIRE") != "true")
            DotEnv.SetCurrentProfile();
#endif

        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddServiceDefaults(builder.Configuration);
        if (builder.Configuration["DOTNET_LIGURIA_ASPIRE"] == "true")
            builder.Services.AddHealthChecks().AddCheck<MongoDatabaseHealthCheck>("mongodb");
        builder.Services.AddCors(options =>
        {
            options.AddPolicy(_corsPolicy, policy =>
            {
                policy
                    .AllowAnyOrigin()
                    // .WithOrigins(AllowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        ConfigureAuthentication(builder.Services, builder.Configuration);
        ConfigureAuthorization(builder.Services, builder.Configuration);
        ConfigureRateLimiting(builder.Services);

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        builder.Services.Configure<DotNetLiguriaDatabaseSettings>(
        builder.Configuration.GetSection("DotNetLiguriaDatabase"));

        builder.Services.AddSingleton<WorkshopService>();
        builder.Services.AddSingleton<SpeakerService>();
        builder.Services.AddSingleton<BoardService>();
        builder.Services.AddSingleton<CounterService>();
        builder.Services.AddSingleton<WorkshopFileService>();
        builder.Services.AddSingleton<TopMenuService>();
        builder.Services.AddSingleton<FeedbackService>();
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<IQuestionnaireStore, MongoQuestionnaireStore>();
        builder.Services.AddSingleton<QuestionnaireService>();

        var app = builder.Build();
        app.UseCors(_corsPolicy);

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            app.UseDeveloperExceptionPage();
            //app.UseHsts();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseStaticFiles();
        
        var contentsPath = Path.Combine(builder.Environment.ContentRootPath, "Contents");
        if (!Directory.Exists(contentsPath))
        {
            Directory.CreateDirectory(contentsPath);
        }
        
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(contentsPath),
            RequestPath = "/Contents"
        });
        
        app.UseRouting();
        app.UseRateLimiter();

        app.UseAuthorization();

        // Map API controllers first
        app.MapControllers();
        app.MapServiceDefaults();

        // Handle development-time browser scripts
        if (app.Environment.IsDevelopment())
        {
            // Handle browser refresh script
            app.MapGet("/_framework/aspnetcore-browser-refresh.js", async context =>
            {
                context.Response.ContentType = "application/javascript; charset=utf-8";
                await context.Response.WriteAsync("// ASP.NET Core browser refresh disabled for SPA");
            });

            // Handle browser link script and related endpoints
            app.MapGet("/_vs/browserLink", async context =>
            {
                context.Response.ContentType = "application/javascript; charset=utf-8";
                await context.Response.WriteAsync("// Browser Link disabled for SPA");
            });

            app.MapPost("/_vs/browserLink", async context =>
            {
                context.Response.StatusCode = 200;
                await context.Response.WriteAsync("OK");
            });

            // Handle any other _vs/ requests
            app.MapFallback("/_vs/{**path}", async context =>
            {
                context.Response.StatusCode = 200;
                await context.Response.WriteAsync("OK");
            });
        }

        // Map SPA fallback last - this ensures API routes are handled before fallback
        app.MapFallbackToFile("/index.html");
        //    .WithMetadata(new HttpMethodMetadata(new[] { "GET" }));   // specify more verbs on static pages


        // old style mapping for the fallback file
        //app.UseEndpoints(endpoints =>
        //{
        //    endpoints.MapControllers();
        //    endpoints.MapFallbackToFile("/index.html");
        //});

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
        var authServerSection = configuration.GetSection(_authServerSectionName);
        services.Configure<AuthServerConfiguration>(authServerSection);
        var authServerConfig = authServerSection.Get<AuthServerConfiguration>();

        if (authServerConfig == null)
        {
            throw new InvalidOperationException(
                $"The configuraton '{_authServerSectionName}' cannot be found");
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
            options.MapInboundClaims = false;

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

    private static void ConfigureAuthorization(IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.Configure<QuestionnaireAuthorizationOptions>(
            configuration.GetSection(QuestionnaireAuthorizationOptions.SectionName));
        services.AddAuthorization(options =>
        {
            options.AddPolicy("mfa",
                policy => policy.Requirements.Add(new OtpRequirement("mfa")));

            options.AddPolicy("hwk",
                policy => policy.Requirements.Add(new OtpRequirement("hwk")));

            // The SPA calls the API with a Keycloak bearer token.
            options.AddPolicy(QuestionnaireAuthorizationOptions.PolicyName, policy => policy
                .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
                .RequireAuthenticatedUser()
                .AddRequirements(new FeedbackAdminRequirement()));
        });

        services.AddScoped<IAuthorizationHandler, OtpRequirementHandler>();
        services.AddSingleton<IAuthorizationHandler, FeedbackAdminHandler>();
    }

    private static void ConfigureRateLimiting(IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(PublicQuestionnaireRateLimit.PolicyName, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = PublicQuestionnaireRateLimit.PermitLimit,
                        Window = PublicQuestionnaireRateLimit.Window,
                        QueueLimit = 0,
                    }));
        });
    }
}