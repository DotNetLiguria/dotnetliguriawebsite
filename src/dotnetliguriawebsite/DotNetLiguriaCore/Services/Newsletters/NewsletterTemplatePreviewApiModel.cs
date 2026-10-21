namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTemplatePreviewApiModel(string Subject, string Markdown, string Html,
    string PlainText, IReadOnlyList<NewsletterPreviewImageApiModel> Images, IReadOnlyList<string> Warnings);
