namespace DotNetLiguriaCore.Authorization;

public class WebDevAdminAuthorizationOptions
{
    public const string SectionName = "WebDevAdminAuthorization";
    public const string PolicyName = "WebDevAdmin";

    public string AdminRole { get; set; } = "dnl-webdevadmin";
    public string AdminClaim { get; set; } = "dnl-webdevadmin";
}
