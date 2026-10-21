namespace DotNetLiguriaCore.Services.Newsletters;

public sealed class NewsletterSnapshotImage
{
    public string Cid { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] Data { get; set; } = [];
    public string Digest { get; set; } = "";
}
