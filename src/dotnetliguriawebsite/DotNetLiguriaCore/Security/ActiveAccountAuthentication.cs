using DotNetLiguriaCore.Services.Privacy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;

namespace DotNetLiguriaCore.Security;

public static class ActiveAccountAuthentication
{
    private const string _dependencyFailureItem = "DotNetLiguria.IdentityVerificationUnavailable";

    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        try
        {
            var services = context.HttpContext.RequestServices;
            var options = services.GetRequiredService<IOptions<PrivacyOptions>>().Value;
            if (context.Principal is null)
            {
                context.Fail("Invalid account identity.");
                return;
            }
            var account = AccountReference.FromPrincipal(context.Principal, options.Issuer);
            var gate = services.GetRequiredService<PrivacyOperationGate>();
            using var lease = await gate.EnterAsync(context.HttpContext.RequestAborted);
            var profile = await services.GetRequiredService<IIdentityAccountAdmin>()
                .GetAsync(account, context.HttpContext.RequestAborted);
            if (profile is null || !profile.Enabled || profile.Id != account.Subject)
                context.Fail("Account disabled or deleted.");
        }
        catch (PrivacyBlockedException exception)
        {
            if (exception.StatusCode >= 500)
                context.HttpContext.Items[_dependencyFailureItem] = true;
            context.Fail("Account verification failed.");
        }
        catch (Exception exception) when (exception is HttpRequestException or OperationCanceledException or
            IOException or UnauthorizedAccessException or System.Text.Json.JsonException or
            System.Security.Cryptography.CryptographicException)
        {
            context.HttpContext.Items[_dependencyFailureItem] = true;
            context.Fail("Account verification unavailable.");
        }
    }

    public static Task ChallengeAsync(JwtBearerChallengeContext context)
    {
        context.HandleResponse();
        if (context.HttpContext.Items[_dependencyFailureItem] is not true)
        {
            context.Response.Headers.WWWAuthenticate = "Bearer";
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized,
                title: "Bearer authentication required",
                extensions: new Dictionary<string, object?> { ["code"] = "unauthorized" })
                .ExecuteAsync(context.HttpContext);
        }
        return Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Identity verification unavailable",
            extensions: new Dictionary<string, object?> { ["code"] = "identity_verification_unavailable" })
            .ExecuteAsync(context.HttpContext);
    }
}
