namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterGenerateRequest(int Version, Guid? EventId, Guid TemplateId);
