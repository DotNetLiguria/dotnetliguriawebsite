namespace DotNetLiguriaCore.Services;

public sealed class EventbriteOptions
{
    public const string SectionName = "Eventbrite";

    public string? AccessToken { get; set; }
    public string? OrganizationId { get; set; }
    public string? OrganizerId { get; set; }
    public string TimeZoneId { get; set; } = "Europe/Rome";
    public string Currency { get; set; } = "EUR";
    public string CountryCode { get; set; } = "IT";
}
