using MimeKit;

namespace DotNetLiguriaCore.Services.Privacy.Notices;

public sealed class PrivacySmtpOptions
{
    internal bool BindingInvalid { get; set; }
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string TlsMode { get; set; } = "StartTls";
    public string Sender { get; set; } = "";
    public string[] AdministratorRecipients { get; set; } = [];
    public string DashboardUrl { get; set; } = "";
    public string? UserName { get; set; }
    public string? Password { get; set; }

    public string? ConfigurationErrorCode()
    {
        if (BindingInvalid) return "smtp_configuration_invalid";
        if (string.IsNullOrWhiteSpace(Host) || string.IsNullOrWhiteSpace(Sender) ||
            AdministratorRecipients is null || AdministratorRecipients.Length == 0 ||
            string.IsNullOrWhiteSpace(DashboardUrl))
            return "smtp_not_configured";
        if (Uri.CheckHostName(Host) == UriHostNameType.Unknown || Port is < 1 or > 65535 ||
            TlsMode is not ("StartTls" or "SslOnConnect") || !IsMailbox(Sender) ||
            AdministratorRecipients.Length > 20 || AdministratorRecipients.Any(recipient => !IsMailbox(recipient)) ||
            !Uri.TryCreate(DashboardUrl, UriKind.Absolute, out var dashboard) ||
            dashboard.Scheme != Uri.UriSchemeHttps || dashboard.AbsolutePath != "/admin/privacy" ||
            dashboard.UserInfo.Length != 0 || dashboard.Query.Length != 0 || dashboard.Fragment.Length != 0 ||
            DashboardUrl.Any(char.IsControl) ||
            string.IsNullOrWhiteSpace(UserName) || string.IsNullOrWhiteSpace(Password))
            return "smtp_configuration_invalid";
        return null;
    }

    private static bool IsMailbox(string? value) =>
        !string.IsNullOrWhiteSpace(value) && !value.Any(char.IsControl) &&
        value.LastIndexOf('@') > 0 && value.LastIndexOf('@') < value.Length - 1 &&
        MailboxAddress.TryParse(value, out var mailbox) && mailbox.Address == value;
}
