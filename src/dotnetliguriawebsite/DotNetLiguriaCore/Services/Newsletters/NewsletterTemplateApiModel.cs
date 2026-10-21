namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTemplateApiModel(
    string Id, string Kind, string Name, string Subject, string Markdown, int Version, bool Archived);
