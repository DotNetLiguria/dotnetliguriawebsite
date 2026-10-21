namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterApiModel(
    string Id, string Kind, string Title, string Subject, string Markdown, int Version,
    Guid? TemplateId, int? TemplateVersion, Guid? EventId, bool Archived,
    string ProductionStatus, DateTimeOffset UpdatedAt, IReadOnlyList<NewsletterAttemptApiModel>? Attempts = null);
