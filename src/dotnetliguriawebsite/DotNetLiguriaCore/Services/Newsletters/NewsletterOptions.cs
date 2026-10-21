namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterOptions
{
    public const string SectionName = "Newsletters";

    public string DefaultTestAddress { get; set; } = "";
    public string DistributionAddress { get; set; } = "";
    public string[] DistributionAliases { get; set; } = [];
    public bool TestEnabled { get; set; }
    public bool ProductionEnabled { get; set; }
    public string ActivationGeneration { get; set; } = "";
    public string OperationalFolder { get; set; } = "";
    public string PublicBaseUrl { get; set; } = "";
    public string SenderAddress { get; set; } = "";
    public string SenderName { get; set; } = "DotNetLiguria";
    public string ReplyToAddress { get; set; } = "";
    public string SmtpHost { get; set; } = "";
    public int SmtpPort { get; set; } = 587;
    public bool SmtpUseStartTls { get; set; } = true;
    public string SmtpUserName { get; set; } = "";
    public string SmtpPassword { get; set; } = "";
    public int SmtpTimeoutSeconds { get; set; } = 30;
    public int MaxImageBytes { get; set; } = 2 * 1024 * 1024;
    public int MaxMimeBytes { get; set; } = 10 * 1024 * 1024;
    public int MaxImages { get; set; } = 8;

    public bool HasSmtpConfiguration =>
        !string.IsNullOrWhiteSpace(SmtpHost) &&
        Uri.CheckHostName(SmtpHost) != UriHostNameType.Unknown &&
        SmtpPort is > 0 and <= 65535 &&
        !string.IsNullOrWhiteSpace(SenderAddress) &&
        IsMailbox(SenderAddress) &&
        (string.IsNullOrWhiteSpace(ReplyToAddress) || IsMailbox(ReplyToAddress)) &&
        SenderName is not null && !SenderName.Any(char.IsControl) &&
        (string.IsNullOrWhiteSpace(SmtpUserName) || !string.IsNullOrWhiteSpace(SmtpPassword));

    public bool IsProductionReady =>
        ProductionEnabled && HasSmtpConfiguration && IsMailbox(DistributionAddress) &&
        IsTestAddressAllowed(DefaultTestAddress) &&
        !string.IsNullOrWhiteSpace(ActivationGeneration);

    public bool IsTestAddressAllowed(string? address) =>
        IsMailbox(address) && !SameMailbox(address!, DistributionAddress) &&
        !(DistributionAliases ?? []).Any(alias => SameMailbox(address!, alias));

    public static bool IsMailbox(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Length <= 254 &&
        !value.Any(char.IsControl) &&
        System.Net.Mail.MailAddress.TryCreate(value, out var parsed) &&
        string.Equals(parsed.Address, value.Trim(), StringComparison.OrdinalIgnoreCase) &&
        !value.Contains(',') &&
        !value.Contains(';');

    private static bool SameMailbox(string left, string right) =>
        IsMailbox(right) && string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
}
