using Microsoft.AspNetCore.Authorization;

namespace DotNetLiguriaCore.Authorization;

/// <summary>
/// This is the handler for the OtpRequirement
/// </summary>
public class OtpRequirementHandler : AuthorizationHandler<OtpRequirement>
{
    private readonly ILogger<OtpRequirementHandler> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public OtpRequirementHandler(
        ILogger<OtpRequirementHandler> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OtpRequirement requirement)
    {
        var ctx = _httpContextAccessor.HttpContext;
        var userName = context.User.Identity?.Name ?? "guest";
        if (ctx == null) return Task.CompletedTask;

        // This puts "mfa" or "hwk" in the context
        // the item in the context will be given to the Identity Provider
        // at the next Challenge
        ctx.Items["acr"] = requirement.Name;

        var hasAcrOtp = context.User.Claims
            .Any(c => c.Type == "acr" && c.Value == requirement.Name);

        if (hasAcrOtp)
        {
            _logger.LogInformation(
                $"User {userName} was authenticated with OTP {requirement.Name}");
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        _logger.LogInformation(
            $"User {userName} fails the OTP requirement of {requirement.Name}");
        return Task.CompletedTask;
    }

}