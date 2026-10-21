namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterCreateRequest(string Kind, string Title, string Subject, string Markdown,
    Guid? TemplateId = null, Guid? EventId = null);
