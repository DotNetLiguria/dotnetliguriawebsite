using System.Diagnostics;

using CommonAuth;

using CommonWeb;

using DotNetLiguriaCore.Authorization;
using DotNetLiguriaCore.Endpoints;
using DotNetLiguriaCore.Services;
using DotNetLiguriaCore.Services.Questionnaires;
using DotNetLiguriaCore.Services.Privacy;
using DotNetLiguriaCore.Services.Access;
using DotNetLiguriaCore.Services.Photos;
using DotNetLiguriaCore.Services.Newsletters;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using DotNetLiguria.ServiceDefaults;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using DotNetLiguriaCore.Security;
using DotNetLiguriaCore.Storage;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using NetEscapades.Extensions.Logging.RollingFile;

namespace DotNetLiguriaCore;

public class Program
{
    private const string _authServerSectionName = "AuthServer";
    private const string _corsPolicy = "DotNetLiguriaCorsPolicy";

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
        var storagePaths = new WebsiteStoragePaths(builder.Configuration, builder.Environment);
        storagePaths.EnsureDirectories();
        if (string.IsNullOrWhiteSpace(builder.Configuration["DotNetLiguriaDatabase:BackupFolder"]))
            builder.Configuration["DotNetLiguriaDatabase:BackupFolder"] = storagePaths.BackupsRoot;
        if (string.IsNullOrWhiteSpace(builder.Configuration["ProfilePhotos:Root"]))
            builder.Configuration["ProfilePhotos:Root"] = storagePaths.ProfilePhotosRoot;
        if (string.IsNullOrWhiteSpace(builder.Configuration["Newsletters:OperationalFolder"]))
            builder.Configuration["Newsletters:OperationalFolder"] = storagePaths.NewsletterOperationsRoot;
        builder.Services.AddSingleton(storagePaths);
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(storagePaths.DataProtectionKeysRoot));

        var logDirectory = storagePaths.LogsRoot;
        builder.Logging.AddFile(options =>
        {
            options.FileName = "website-";
            options.LogDirectory = logDirectory;
            options.Extension = "log";
            options.Periodicity = PeriodicityOptions.Daily;
            options.FileSizeLimit = null;
            options.FilesPerPeriodicityLimit = 1;
            options.RetainedFileCountLimit = DailyLogHeartbeatWorker.MaximumRetainedFiles;
        });
        if (builder.Environment.IsDevelopment() &&
            (string.IsNullOrWhiteSpace(builder.Configuration["AllowedHosts"]) ||
             builder.Configuration["AllowedHosts"] == "dotnetliguria.net;www.dotnetliguria.net"))
            builder.Configuration["AllowedHosts"] = "localhost;127.0.0.1;[::1]";
        if (!builder.Environment.IsDevelopment() &&
            (string.IsNullOrWhiteSpace(builder.Configuration["AllowedHosts"]) ||
             builder.Configuration["AllowedHosts"] == "*"))
            builder.Configuration["AllowedHosts"] = "dotnetliguria.net;www.dotnetliguria.net";
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
            ProxyConfiguration.Configure(options, builder.Configuration));
        builder.Services.Configure<FormOptions>(options =>
        {
            options.MultipartBodyLengthLimit = 25 * 1024 * 1024;
            options.ValueLengthLimit = 64 * 1024;
            options.ValueCountLimit = 100;
        });
        builder.Services.AddServiceDefaults(builder.Configuration);
        builder.Services.AddHostedService<DailyLogHeartbeatWorker>();
        if (builder.Configuration["DOTNET_LIGURIA_ASPIRE"] == "true")
            builder.Services.AddHealthChecks().AddCheck<MongoDatabaseHealthCheck>("mongodb");
        builder.Services.AddCors(options =>
        {
            options.AddPolicy(_corsPolicy, policy =>
            {
                var origins = builder.Configuration.GetSection("Security:CorsOrigins").Get<string[]>() ??
                    (builder.Environment.IsDevelopment() ? ["https://localhost:3443"] : []);
                if (origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var parsed) ||
                    parsed.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(parsed.UserInfo) ||
                    parsed.AbsolutePath != "/" || !string.IsNullOrEmpty(parsed.Query) ||
                    !string.IsNullOrEmpty(parsed.Fragment) || parsed.Host.Contains('*')))
                    throw new InvalidOperationException("Security:CorsOrigins must contain exact HTTPS origins only.");
                if (origins.Length > 0)
                    policy.WithOrigins(origins);
                policy.WithHeaders("Content-Type", "Authorization", "Accept", "X-Confirm-Erasure",
                        "X-Confirm-Retention-Policy", "X-Confirm-Campaign", "X-Admin-Request",
                        "X-Confirm-Repair", "X-Confirm-Access-Change", "X-Confirm-Board-Change", "X-Confirm-Speaker-Change")
                    .WithExposedHeaders("X-Page-Offset", "X-Page-Limit", "X-Next-Offset", "Content-Disposition")
                    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS");
            });
        });

        if (!builder.Environment.IsDevelopment() &&
            string.IsNullOrWhiteSpace(builder.Configuration["AuthServer:ClientSecret"]))
            throw new InvalidOperationException("The confidential backend OIDC client secret must be supplied through runtime configuration.");
        if (builder.Configuration["Privacy:Issuer"] != builder.Configuration["AuthServer:Authority"])
            throw new InvalidOperationException("Privacy:Issuer must exactly match AuthServer:Authority.");
        ConfigureAuthentication(builder.Services, builder.Configuration);
        ConfigureAuthorization(builder.Services, builder.Configuration);
        ConfigureRateLimiting(builder.Services);

        builder.Services.AddValidation();
        builder.Services.AddProblemDetails();
        builder.Services.AddExceptionHandler<SafeExceptionHandler>();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        builder.Services.AddOptions<DotNetLiguriaDatabaseSettings>()
            .Bind(builder.Configuration.GetSection("DotNetLiguriaDatabase"))
            .Validate(settings => !string.IsNullOrWhiteSpace(settings.ConnectionString),
                "DotNetLiguriaDatabase:ConnectionString must be supplied through runtime configuration.")
            .Validate(settings => !string.IsNullOrWhiteSpace(settings.BackupFolder),
                "DotNetLiguriaDatabase:BackupFolder must be configured.")
            .ValidateOnStart();
        builder.Services.AddSingleton<WorkshopService>();
        builder.Services.AddSingleton<SpeakerService>();
        builder.Services.AddSingleton<BoardService>();
        builder.Services.AddSingleton<CounterService>();
        builder.Services.AddSingleton<WorkshopFileService>();
        builder.Services.AddSingleton<WorkshopAssetStorage>();
        builder.Services.AddSingleton(new PersistedAssetSnapshotService(
            storagePaths.ContentsRoot, storagePaths.PrivateUploadsRoot));
        builder.Services.AddHttpClient<SessionizeImportService>()
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddOptions<EventbriteOptions>()
            .Bind(builder.Configuration.GetSection(EventbriteOptions.SectionName));
        builder.Services.AddHttpClient<EventbriteApiClient>(client =>
            client.BaseAddress = new Uri("https://www.eventbriteapi.com/v3/"))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        builder.Services.AddTransient<EventbriteIntegrationService>();
        builder.Services.AddSingleton<TopMenuService>();
        builder.Services.AddSingleton<VenueService>();
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<IQuestionnaireStore, MongoQuestionnaireStore>();
        builder.Services.AddSingleton<QuestionnaireService>();
        builder.Services.AddSingleton<DatabaseBackupService>();
        builder.Services.Configure<PhotoOptions>(builder.Configuration.GetSection("ProfilePhotos"));
        builder.Services.AddSingleton<IPhotoStore, MongoPhotoStore>();
        builder.Services.AddSingleton<PhotoStorage>();
        builder.Services.AddSingleton<PhotoService>();
        builder.Services.AddSingleton<PhotoLifecycle>();
        builder.Services.AddSingleton<PhotoSnapshotService>();
        builder.Services.AddSingleton<PhotoMutationAudit>();
        builder.Services.AddPrivacyServices(builder.Configuration, builder.Environment);
        builder.Services.AddNewsletterServices(builder.Configuration);
        builder.Services.AddScoped<ActiveAccountWriteFilter>();
        builder.Services.AddPermissionDirectory(builder.Configuration);
        builder.Services.AddSingleton<LegacySpeakerReferenceRepairService>();

        var app = builder.Build();
        app.UseForwardedHeaders();
        app.UseMiddleware<SecurityHeadersMiddleware>();
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
            app.UseDeveloperExceptionPage();
            //app.UseHsts();
        }
        else
        {
            app.UseExceptionHandler();
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseStaticFiles();
        
        var contentsPath = storagePaths.ContentsRoot;
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(contentsPath),
            RequestPath = "/Contents"
        });
        
        app.UseRouting();
        app.UseCors(_corsPolicy);
        app.UseRateLimiter();

        app.UseAuthorization();

        app.MapApiEndpoints();
        app.MapPrivacyEndpoints();
        app.MapAccountEndpoints();
        app.MapNotificationEndpoints();
        app.MapAccessEndpoints();
        app.MapPhotoEndpoints();
        app.MapNewsletterEndpoints();
        app.MapNewsletterTemplateEndpoints();
        app.MapSpeakerAccountEndpoints();
        app.MapServiceDefaults();
        app.MapFallback("/api/{**path}", () => Results.Problem(
            statusCode: StatusCodes.Status404NotFound, title: "ApiEndpointNotFound"));

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
        if (!Uri.TryCreate(authServerConfig.Authority, UriKind.Absolute, out var authority) ||
            authority.Scheme != Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(authority.UserInfo) ||
            !string.IsNullOrEmpty(authority.Query) || !string.IsNullOrEmpty(authority.Fragment) ||
            !Uri.TryCreate(authServerConfig.MetadataAddress, UriKind.Absolute, out var metadata) ||
            metadata.Scheme != Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(metadata.UserInfo) || !string.IsNullOrEmpty(metadata.Query) ||
            !string.IsNullOrEmpty(metadata.Fragment) ||
            metadata.Authority != authority.Authority ||
            !metadata.AbsolutePath.StartsWith(authority.AbsolutePath.TrimEnd('/') + "/", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(authServerConfig.ClientId) ||
            string.IsNullOrWhiteSpace(authServerConfig.Audience))
            throw new InvalidOperationException("AuthServer must specify an HTTPS issuer, matching HTTPS metadata, client ID and audience.");

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
            options.RequireHttpsMetadata = true;
            options.Audience = authServerConfig.Audience;
            options.Authority = authServerConfig.Authority;
            options.Events = new JwtBearerEvents()
            {
                OnChallenge = ActiveAccountAuthentication.ChallengeAsync,
                OnMessageReceived = x => Dbg($"JWT: OnMessageReceived "),
                OnAuthenticationFailed = x => Dbg("JWT: Authentication failed"),
                OnTokenValidated = ActiveAccountAuthentication.ValidateAsync,
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
        services.AddPermissionAuthorization();
        services.AddAuthorization(options =>
        {
            options.AddPolicy("mfa",
                policy => policy.Requirements.Add(new OtpRequirement("mfa")));

            options.AddPolicy("hwk",
                policy => policy.Requirements.Add(new OtpRequirement("hwk")));

        });

        services.AddScoped<IAuthorizationHandler, OtpRequirementHandler>();
    }

    private static void ConfigureRateLimiting(IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
            options.AddPolicy(PublicQuestionnaireRateLimit.PolicyName, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = PublicQuestionnaireRateLimit.PermitLimit,
                        Window = PublicQuestionnaireRateLimit.Window,
                        QueueLimit = 0,
                    }));
            options.AddPolicy("api-writes", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    (context.User.FindFirst("iss")?.Value ?? "") + "|" +
                    (context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                    }));
            options.AddPolicy("newsletter-write", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    (context.User.FindFirst("iss")?.Value ?? "") + "|" +
                    (context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 40, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                    }));
            options.AddPolicy("newsletter-render", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    (context.User.FindFirst("iss")?.Value ?? "") + "|" +
                    (context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                    }));
            options.AddPolicy("newsletter-upload", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    (context.User.FindFirst("iss")?.Value ?? "") + "|" +
                    (context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                    }));
            options.AddPolicy("newsletter-send", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    (context.User.FindFirst("iss")?.Value ?? "") + "|" +
                    (context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5, Window = TimeSpan.FromHours(1), QueueLimit = 0
                    }));
        });
    }
}
