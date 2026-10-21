namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterUpdateRequest(int Version, string Title, string Subject, string Markdown);
