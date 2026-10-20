namespace DotNetLiguriaCore.Services.Photos;

public sealed record PhotoCrop(float X, float Y, float Size)
{
    public static PhotoCrop Center { get; } = new(0.5f, 0.5f, 1f);
}
