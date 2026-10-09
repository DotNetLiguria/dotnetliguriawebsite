using DotNetLiguriaCore.Model;

namespace DotNetLiguriaCore.Services.Questionnaires;

public class QuestionnaireOperationResult<T>
{
    public QuestionnaireOperationStatus Status { get; init; }
    public T? Value { get; init; }
    public string? Message { get; init; }
    public IReadOnlyList<QuestionnaireValidationError> Errors { get; init; } = [];

    public static QuestionnaireOperationResult<T> Ok(T value) => new() { Status = QuestionnaireOperationStatus.Ok, Value = value };

    public static QuestionnaireOperationResult<T> Fail(QuestionnaireOperationStatus status, string message,
        IReadOnlyList<QuestionnaireValidationError>? errors = null) =>
        new() { Status = status, Message = message, Errors = errors ?? [] };
}
