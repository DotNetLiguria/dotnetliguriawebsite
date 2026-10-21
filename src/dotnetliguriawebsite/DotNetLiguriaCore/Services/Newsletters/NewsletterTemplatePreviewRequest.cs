namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterTemplatePreviewRequest(int Version, Guid? EventId = null);
