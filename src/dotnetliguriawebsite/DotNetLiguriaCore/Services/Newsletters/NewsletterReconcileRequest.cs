namespace DotNetLiguriaCore.Services.Newsletters;

public sealed record NewsletterReconcileRequest(Guid AttemptId, string Outcome, string Reason);
