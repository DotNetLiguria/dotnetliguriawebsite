namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTemplateUpdateRequest(int Version, string Name, string Subject, string Markdown);
