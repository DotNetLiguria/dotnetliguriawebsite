namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTemplateCreateRequest(string Kind, string Name, string Subject, string Markdown);
