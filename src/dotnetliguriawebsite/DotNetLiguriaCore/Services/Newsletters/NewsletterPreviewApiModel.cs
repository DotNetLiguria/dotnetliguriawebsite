namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterPreviewApiModel(
    string SnapshotId, string ContentHash, string Subject, string Html, string PlainText,
    IReadOnlyList<NewsletterPreviewImageApiModel> Images, int MessageBytes, IReadOnlyList<string> Warnings);
