namespace DotNetLiguriaCore.Services.Photos;

public sealed record ResolvedPhoto(Guid? AssetId, string? Url, bool Managed);
