namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoChangeRequest(string Version, string Source, string? ExistingKey = null,
    bool ConfirmUnpublish = false, string? ExistingVersion = null);
