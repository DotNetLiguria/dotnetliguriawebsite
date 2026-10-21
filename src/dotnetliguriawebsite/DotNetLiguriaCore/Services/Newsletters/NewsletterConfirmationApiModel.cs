namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterConfirmationApiModel(string ConfirmationId, DateTimeOffset ExpiresAt,
    string DistributionAddress);
