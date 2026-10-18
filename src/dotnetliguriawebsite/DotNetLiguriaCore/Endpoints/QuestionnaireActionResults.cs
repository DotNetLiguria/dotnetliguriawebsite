using DotNetLiguriaCore.Model;
using DotNetLiguriaCore.Services.Questionnaires;
namespace DotNetLiguriaCore.Endpoints;

public static class QuestionnaireActionResults
{
    public static IResult From<T>(QuestionnaireOperationResult<T> result, Func<T, IResult> onSuccess)
    {
        if (result.Status == QuestionnaireOperationStatus.Ok)
        {
            return onSuccess(result.Value!);
        }

        var body = new QuestionnaireProblem
        {
            Code = result.Status.ToString(),
            Message = result.Message ?? string.Empty,
            Errors = result.Errors.ToList(),
        };
        var statusCode = result.Status switch
        {
            QuestionnaireOperationStatus.NotFound => StatusCodes.Status404NotFound,
            QuestionnaireOperationStatus.Invalid => StatusCodes.Status400BadRequest,
            QuestionnaireOperationStatus.Unavailable => StatusCodes.Status410Gone,
            QuestionnaireOperationStatus.Unauthorized => StatusCodes.Status401Unauthorized,
            _ => StatusCodes.Status409Conflict,
        };
        return Results.Json(body, statusCode: statusCode);
    }
}
